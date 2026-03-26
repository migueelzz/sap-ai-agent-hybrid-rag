# PRD — ATEM RAG: Pipeline de Conhecimento SAP
**Projeto:** ATEM | **Responsável:** Miguel Henrique Lemes da Silva
**Stack:** Python 3.13 · PDM · FastAPI · PostgreSQL + pgvector · Docker
**Versão:** 1.0 | **Data:** 2026-03-24

---

## ⚠️ Análise Crítica: O Problema do Chunking Atual

### Diagnóstico

O comportamento atual — **salvar o conteúdo completo do PDF como um único registro no pgvector** — está **incorreto** e inviabiliza o RAG de qualidade. Os motivos são:

**1. Limite de dimensão do embedding**
O modelo `paraphrase-MiniLM-L6-v2` gera vetores de 384 dimensões a partir de textos de até **~256 tokens**. Textos maiores são truncados silenciosamente. Um PDF SAP de 200 páginas tem ~150.000 tokens — o embedding gerado representa apenas as primeiras ~256 palavras do documento inteiro.

**2. Recuperação sem precisão**
Em busca vetorial, a similaridade é calculada entre o vetor da query e o vetor do chunk. Se o chunk for o documento inteiro, o vetor médio dilui a semântica e o retrieval retorna documentos inteiros que podem ou não conter a resposta.

**3. Context window da LLM excedido**
Mesmo que o retrieval funcione, enviar 200 páginas como contexto para a LLM excede qualquer context window e gera custo proibitivo.

### Como deve ser

```
PDF completo (200 páginas)
        │
        ▼ Parsing (por seção/título)
┌───────────────────────────┐
│ Document: "Cap. 3 - FI"   │  ~10-30 páginas
│ Document: "Cap. 4 - CO"   │
└───────┬───────────────────┘
        │
        ▼ Chunking semântico (400 tokens, overlap 60)
┌──────────────────────────────────────────────────┐
│ Chunk 1: "Lançamento contábil é o processo..."   │  ~400 tokens ✓
│ Chunk 2: "...partida simples e dupla no FI..."   │  ~400 tokens ✓
│ Chunk N: ...                                     │
└──────────────────────────────────────────────────┘
        │
        ▼ Embedding por chunk
┌─────────────────────────────────────┐
│ vetor[384] gerado por chunk         │  semântica precisa ✓
│ persistido em chunks.embedding      │
└─────────────────────────────────────┘
```

A tabela `documents` deve armazenar o texto bruto por seção. A tabela `chunks` deve armazenar os pedaços com embedding. **Nunca gerar embedding do documento inteiro.**

---

## TASK 1 — Schema Inicial da Base de Conhecimento

### Objetivo
Criar o schema PostgreSQL completo com extensões vetoriais, full-text e trigram, servindo como fundação para todo o pipeline.

### Problema atual
Schema inexistente ou incompleto. Sem estrutura correta, os dados ingeridos ficam sem relacionamento entre fonte, seção e chunk.

### Decisões de arquitetura

| Decisão | Escolha | Justificativa |
|--------|---------|---------------|
| Extensão vetorial | `pgvector` HNSW | Melhor custo/benefício para MVP, sem servidor externo |
| Full-text | `tsvector` nativo PostgreSQL | Evita dependência extra (Elasticsearch) |
| Fuzzy | `pg_trgm` | Busca por siglas SAP mal grafadas (ex: "ME21" vs "ME 21") |
| Dimensão do vetor | 384 | MiniLM-L6-v2, roda local sem GPU |

### Schema completo

```sql
-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- FONTES (arquivos originais)
-- ============================================================
CREATE TABLE sources (
    id          SERIAL PRIMARY KEY,
    filename    TEXT NOT NULL UNIQUE,
    modulo      TEXT NOT NULL,        -- 'FI' | 'CO' | 'MM' | 'SD'
    release     TEXT,                 -- ex: 'S/4HANA 2023'
    tipo        TEXT DEFAULT 'pdf',   -- 'pdf' | 'codigo' | 'artefato'
    total_pages INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTOS / SEÇÕES (1 por capítulo/seção do PDF)
-- ============================================================
CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    source_id   INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    page_start  INTEGER NOT NULL,
    page_end    INTEGER NOT NULL,
    raw_text    TEXT NOT NULL,        -- texto completo da seção (SEM embedding)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_source ON documents(source_id);

-- ============================================================
-- CHUNKS (unidade de retrieval — TEM embedding)
-- ============================================================
CREATE TABLE chunks (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    tokens          INTEGER,
    embedding       VECTOR(384),      -- gerado por MiniLM-L6-v2
    fts             TSVECTOR GENERATED ALWAYS AS (
                        to_tsvector('portuguese', unaccent(content))
                    ) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índice vetorial HNSW (melhor para query-time)
CREATE INDEX idx_chunks_embedding
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índice full-text
CREATE INDEX idx_chunks_fts ON chunks USING gin(fts);

-- Índice trigram (fuzzy)
CREATE INDEX idx_chunks_trgm ON chunks USING gin(content gin_trgm_ops);

-- ============================================================
-- ENTIDADES SAP (extraídas deterministicamente)
-- ============================================================
CREATE TABLE entities (
    id          SERIAL PRIMARY KEY,
    chunk_id    INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL,  -- 'tabela'|'campo'|'transacao'|'cds'|'termo'
    valor       TEXT NOT NULL,
    contexto    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_chunk  ON entities(chunk_id);
CREATE INDEX idx_entities_valor  ON entities USING gin(valor gin_trgm_ops);
CREATE INDEX idx_entities_tipo   ON entities(tipo);

-- ============================================================
-- ALIASES (sinônimos e abreviações SAP)
-- ============================================================
CREATE TABLE aliases (
    id          SERIAL PRIMARY KEY,
    termo       TEXT NOT NULL,
    alias       TEXT NOT NULL,
    modulo      TEXT,
    UNIQUE(termo, alias)
);

-- Aliases iniciais
INSERT INTO aliases(termo, alias, modulo) VALUES
    ('nota fiscal', 'NF', 'MM'),
    ('pedido de compra', 'PO', 'MM'),
    ('ordem de venda', 'SO', 'SD'),
    ('lançamento contábil', 'posting', 'FI'),
    ('centro de custo', 'CC', 'CO'),
    ('documento contábil', 'FI doc', 'FI');

-- ============================================================
-- CATÁLOGO SAP (transações e objetos conhecidos)
-- ============================================================
CREATE TABLE sap_catalog (
    id          SERIAL PRIMARY KEY,
    tipo        TEXT NOT NULL,   -- 'transacao'|'tabela'|'cds'|'bapi'
    codigo      TEXT NOT NULL UNIQUE,
    descricao   TEXT,
    modulo      TEXT
);

-- Exemplos FI
INSERT INTO sap_catalog(tipo, codigo, descricao, modulo) VALUES
    ('transacao', 'FB01',  'Lançar documento',           'FI'),
    ('transacao', 'FB50',  'Lançar documento G/L',       'FI'),
    ('transacao', 'FS10N', 'Saldo da conta G/L',         'FI'),
    ('tabela',    'BKPF',  'Cabeçalho do documento FI',  'FI'),
    ('tabela',    'BSEG',  'Posições do documento FI',   'FI'),
    ('transacao', 'ME21N', 'Criar pedido de compra',     'MM'),
    ('tabela',    'EKKO',  'Cabeçalho do pedido',        'MM'),
    ('tabela',    'EKPO',  'Posições do pedido',         'MM');
```

### Critérios de aceite
- [ ] `CREATE EXTENSION vector` executado sem erro
- [ ] Índice HNSW criado com parâmetros `m=16, ef_construction=64`
- [ ] Índices GIN para FTS e trigram criados
- [ ] Aliases e catálogo com dados iniciais
- [ ] `SELECT * FROM sap_catalog LIMIT 5` retorna linhas

---

## TASK 2 — Pipeline de Parsing de PDFs

### Objetivo
Extrair texto estruturado do PDF por seção/capítulo, detectando hierarquia de títulos, para alimentar o chunker com unidades semânticas coerentes.

### Problema atual
O parsing atual provavelmente usa `pdfplumber` ou `PyMuPDF` sem detecção de estrutura, despejando todo o texto do PDF em um único bloco. Isso faz com que a seção "4.2 Lançamento Contábil" e "7.8 Parametrização de Impostos" fiquem misturadas no mesmo `document`.

### Estratégia de parsing

```
PDF
 ├── Detectar títulos por tamanho de fonte (PyMuPDF spans)
 ├── Extrair texto por bloco tipográfico
 ├── Identificar tabelas (pdfplumber)
 └── Separar em Document por seção detectada
```

### Implementação

```python
# app/ingestion/parser.py
from __future__ import annotations
import fitz          # PyMuPDF
import pdfplumber
from dataclasses import dataclass, field

TITLE_FONT_THRESHOLD = 13.0   # fonte acima disso = título de seção


@dataclass
class ParsedSection:
    title: str
    page_start: int
    page_end: int
    raw_text: str
    tables: list[list[list[str]]] = field(default_factory=list)


def _is_title(span: dict) -> bool:
    """Heurística: fonte grande + bold + texto curto = título."""
    is_large  = span["size"] >= TITLE_FONT_THRESHOLD
    is_bold   = "Bold" in span.get("font", "") or span.get("flags", 0) & 2**4
    is_short  = len(span["text"].strip()) < 120
    has_text  = len(span["text"].strip()) > 3
    return is_large and is_short and has_text


def parse_pdf(filepath: str) -> list[ParsedSection]:
    doc = fitz.open(filepath)
    sections: list[ParsedSection] = []

    current_title = "Introdução"
    current_lines: list[str] = []
    current_start = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        for block in blocks:
            if block.get("type") != 0:   # 0 = texto
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue

                    if _is_title(span):
                        # Salvar seção anterior
                        if current_lines:
                            sections.append(ParsedSection(
                                title=current_title,
                                page_start=current_start,
                                page_end=page_num,
                                raw_text="\n".join(current_lines),
                            ))
                        current_title = text
                        current_lines = []
                        current_start = page_num
                    else:
                        current_lines.append(text)

    # Última seção
    if current_lines:
        sections.append(ParsedSection(
            title=current_title,
            page_start=current_start,
            page_end=len(doc) - 1,
            raw_text="\n".join(current_lines),
        ))

    doc.close()

    # Enriquecer com tabelas via pdfplumber
    _attach_tables(filepath, sections)

    return sections


def _attach_tables(filepath: str, sections: list[ParsedSection]) -> None:
    """Extrai tabelas e vincula à seção correspondente."""
    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables() or []
            for section in sections:
                if section.page_start <= page_num <= section.page_end:
                    section.tables.extend(tables)
```

### Critérios de aceite
- [ ] PDF de 100 páginas gera pelo menos 10 seções distintas (não 1 bloco)
- [ ] `ParsedSection.title` reflete o título do capítulo real do PDF
- [ ] Tabelas SAP são capturadas em `section.tables`
- [ ] Texto não contém artefatos binários ou lixo de encoding

---

## TASK 3 — Chunking Semântico

### Objetivo
Quebrar cada `ParsedSection` em chunks de ~400 tokens com overlap de ~60 tokens, respeitando limites de parágrafo antes de cortar no meio de uma frase.

### Por que 400 tokens com overlap?

| Parâmetro | Valor | Razão |
|-----------|-------|-------|
| `max_tokens` | 400 | MiniLM-L6-v2 suporta até 256 tokens com qualidade; 400 palavras ≈ 300 tokens |
| `overlap` | 60 | Preserva contexto entre chunks adjacentes |
| Unidade de corte | parágrafo | Evita cortar uma explicação no meio |

### Implementação

```python
# app/ingestion/chunker.py
from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Chunk:
    document_id: int
    chunk_index: int
    content: str
    tokens: int


def _split_paragraphs(text: str) -> list[str]:
    """Divide por linha dupla ou linha única com recuo."""
    import re
    # Normaliza quebras e divide por parágrafo
    text = re.sub(r'\n{3,}', '\n\n', text)
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    return paragraphs


def chunk_text(
    text: str,
    max_tokens: int = 400,
    overlap_tokens: int = 60,
) -> list[str]:
    paragraphs = _split_paragraphs(text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for para in paragraphs:
        para_words = para.split()
        para_len   = len(para_words)

        # Parágrafo sozinho maior que max → quebra forçada por tokens
        if para_len > max_tokens:
            sub_chunks = _force_split(para, max_tokens, overlap_tokens)
            for sub in sub_chunks:
                chunks.append(sub)
            continue

        if current_len + para_len > max_tokens and current:
            chunks.append(" ".join(current))
            # Overlap: mantém últimas N palavras
            overlap_words = " ".join(current).split()[-overlap_tokens:]
            current = list(overlap_words)
            current_len = len(current)

        current.extend(para_words)
        current_len += para_len

    if current:
        chunks.append(" ".join(current))

    return [c for c in chunks if len(c.strip()) > 30]   # descarta chunks triviais


def _force_split(text: str, max_tokens: int, overlap: int) -> list[str]:
    words = text.split()
    result = []
    i = 0
    while i < len(words):
        chunk = words[i: i + max_tokens]
        result.append(" ".join(chunk))
        i += max_tokens - overlap
    return result


def build_chunks(document_id: int, raw_text: str) -> list[Chunk]:
    raw = chunk_text(raw_text)
    return [
        Chunk(
            document_id=document_id,
            chunk_index=idx,
            content=content,
            tokens=len(content.split()),
        )
        for idx, content in enumerate(raw)
    ]
```

### Critérios de aceite
- [ ] Nenhum chunk com mais de 450 palavras
- [ ] Overlap visível entre chunk N e chunk N+1 (últimas palavras de N aparecem no início de N+1)
- [ ] Chunks triviais (< 30 chars) descartados
- [ ] PDF de 200 páginas gera entre 500 e 3000 chunks

---

## TASK 4 — Extração Determinística de Entidades SAP

### Objetivo
Extrair entidades SAP (transações, tabelas, campos, CDS views, termos técnicos) de cada chunk usando regex e dicionário, **sem LLM**, garantindo precisão e velocidade na ingestão.

### Padrões SAP a capturar

| Tipo | Exemplos | Regex |
|------|---------|-------|
| Transação | FB01, ME21N, SE16N | `[A-Z]{1,4}\d{2,4}[A-Z]?` |
| Tabela | BKPF, EKKO, T001 | `\b[A-Z]{2,6}\d{0,2}\b` (contextualizado) |
| CDS View | I_JournalEntry, C_PurchaseOrder | `[IC]_[A-Z][A-Za-z0-9_]+` |
| Campo | BUKRS, WAERS, BELNR | `\b[A-Z]{4,6}\b` (filtrado por dicionário) |
| Termo PT | "lançamento", "partida dupla" | dicionário por módulo |

### Implementação

```python
# app/ingestion/extractor.py
from __future__ import annotations
import re
from dataclasses import dataclass

@dataclass
class Entity:
    chunk_id: int
    tipo: str
    valor: str
    contexto: str


# ─── Padrões determinísticos ────────────────────────────────
_RE_TRANSACAO = re.compile(r'\b([A-Z]{1,4}\d{2,4}[A-Z]?)\b')
_RE_CDS       = re.compile(r'\b([IC]_[A-Z][A-Za-z0-9_]{3,})\b')

# Dicionários por módulo (expansível)
_TABELAS_SAP = {
    "FI": {"BKPF","BSEG","SKA1","SKB1","T001","T030"},
    "MM": {"EKKO","EKPO","MARA","MARC","MAKT","T024"},
    "SD": {"VBAK","VBAP","LIKP","LIPS","VBRK","VBRP"},
    "CO": {"COSP","COSS","CSKS","CSKT","AUFK"},
}
_TODOS_TABELAS = {t for s in _TABELAS_SAP.values() for t in s}

_TERMOS = {
    "FI": [
        "lançamento contábil","partida simples","partida dupla",
        "documento contábil","plano de contas","razão","balancete",
        "centro de lucro","nota de débito","nota de crédito",
    ],
    "CO": [
        "centro de custo","ordem interna","resultado analítico",
        "rateio","distribuição","liquidação","controlling",
    ],
    "MM": [
        "pedido de compra","recebimento de mercadoria","nota fiscal",
        "fornecedor","requisição de compra","contrato","cotação",
    ],
    "SD": [
        "pedido de venda","faturamento","entrega","cliente",
        "ordem de venda","condição de preço","expedição",
    ],
}


def extract_entities(chunk_id: int, content: str) -> list[Entity]:
    entities: list[Entity] = []
    content_up = content.upper()

    def _ctx(match) -> str:
        s = max(0, match.start() - 50)
        e = min(len(content), match.end() + 50)
        return content[s:e].replace("\n", " ")

    # Transações
    for m in _RE_TRANSACAO.finditer(content_up):
        entities.append(Entity(chunk_id, "transacao", m.group(1), _ctx(m)))

    # CDS Views
    for m in _RE_CDS.finditer(content):
        entities.append(Entity(chunk_id, "cds", m.group(1), _ctx(m)))

    # Tabelas (apenas as conhecidas no dicionário)
    for word in set(content_up.split()):
        clean = re.sub(r'[^A-Z0-9]', '', word)
        if clean in _TODOS_TABELAS:
            entities.append(Entity(chunk_id, "tabela", clean, content[:80]))

    # Termos por módulo
    content_low = content.lower()
    for modulo, termos in _TERMOS.items():
        for termo in termos:
            if termo in content_low:
                idx = content_low.index(termo)
                ctx = content[max(0,idx-30):idx+len(termo)+30]
                entities.append(Entity(chunk_id, "termo", termo, ctx))

    # Deduplicar por (tipo, valor)
    seen = set()
    unique = []
    for e in entities:
        key = (e.tipo, e.valor)
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique
```

### Critérios de aceite
- [ ] Transação `FB01` encontrada em chunk que menciona "FB01"
- [ ] Tabela `BKPF` identificada corretamente
- [ ] Termos PT (`lançamento contábil`) extraídos com contexto
- [ ] Nenhum falso positivo óbvio (ex: "SAP" classificado como tabela)
- [ ] Deduplicação por `(tipo, valor)` funcionando

---

## TASK 5 — Geração de Embeddings e Persistência

### Objetivo
Gerar vetores de 384 dimensões para cada chunk normalizado e persistir no PostgreSQL via pgvector. Processamento em batch para performance.

### Regra crítica
**Embeddings são gerados APENAS para `chunks.content`, nunca para `documents.raw_text`.**

### Implementação

```python
# app/ingestion/embedder.py
from __future__ import annotations
import re, string
import numpy as np
import nltk
from nltk.corpus import stopwords
from nltk.stem import SnowballStemmer
from sentence_transformers import SentenceTransformer
from functools import lru_cache

nltk.download("punkt",     quiet=True)
nltk.download("stopwords", quiet=True)

@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Singleton — carrega o modelo uma vez por processo."""
    return SentenceTransformer("paraphrase-MiniLM-L6-v2")


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"\s+", " ", text).strip()
    words = text.split()
    stop_words = set(stopwords.words("portuguese"))
    words = [w for w in words if w not in stop_words]
    stemmer = SnowballStemmer("portuguese")
    words = [stemmer.stem(w) for w in words]
    return " ".join(words)


def generate_embedding(text: str) -> list[float]:
    """Embedding para um único texto. Use batch_embeddings em ingestão."""
    model = _get_model()
    normalized = normalize_text(text)
    vector: np.ndarray = model.encode(normalized, normalize_embeddings=True)
    return vector.tolist()


def batch_embeddings(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """
    Geração em batch — use sempre durante ingestão.
    normalize_embeddings=True melhora similaridade cosseno.
    """
    model = _get_model()
    normalized = [normalize_text(t) for t in texts]
    vectors = model.encode(
        normalized,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    return [v.tolist() for v in vectors]
```

### Persistência (trecho do router de ingestão)

```python
# Ao persistir chunk — NUNCA usar documents.raw_text aqui
chunk_row = await db.execute(
    text("""
        INSERT INTO chunks(document_id, chunk_index, content, embedding, tokens)
        VALUES(:did, :ci, :ct, :emb::vector, :tk)
        RETURNING id
    """),
    {
        "did": doc_id,
        "ci":  chunk.chunk_index,
        "ct":  chunk.content,
        "emb": str(chunk_embedding),   # lista de 384 floats como string
        "tk":  chunk.tokens,
    },
)
```

### Critérios de aceite
- [ ] `SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL` cresce a cada ingestão
- [ ] `SELECT array_length(embedding::float[], 1) FROM chunks LIMIT 1` retorna 384
- [ ] Tempo de ingestão de 100 chunks < 30 segundos (CPU)
- [ ] `_get_model()` chamado uma única vez por processo (lru_cache)

---

## TASK 6 — Full-Text e Trigram na Base

### Objetivo
Habilitar busca lexical (FTS) e fuzzy (trigram) nos chunks como complemento à busca vetorial, essencial para termos técnicos SAP que o modelo semântico não reconhece bem.

### Por que FTS + trigram além do vetor?

| Busca | Boa para | Ruim para |
|-------|---------|-----------|
| Vetorial | Semântica, sinônimos | Siglas exatas, nomes de tabelas |
| FTS | Palavras exatas, stemming | Erros ortográficos |
| Trigram | Erros, abreviações, substrings | Performance em tabelas grandes |

Combinando os três: cobertura máxima.

### O que já está no schema (Task 1)

```sql
-- FTS (automático via GENERATED ALWAYS)
fts TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', unaccent(content))
) STORED

-- Índices
CREATE INDEX idx_chunks_fts  ON chunks USING gin(fts);
CREATE INDEX idx_chunks_trgm ON chunks USING gin(content gin_trgm_ops);
```

### Implementação das buscas

```python
# app/retrieval/hybrid.py (seção FTS e trigram)

async def fts_search(
    session: AsyncSession,
    query: str,
    top_k: int = 20,
) -> list[dict]:
    """Full-text search com websearch_to_tsquery (suporta operadores naturais)."""
    sql = text("""
        SELECT
            id,
            content,
            document_id,
            ts_rank_cd(fts, websearch_to_tsquery('portuguese', unaccent(:q))) AS score
        FROM chunks
        WHERE fts @@ websearch_to_tsquery('portuguese', unaccent(:q))
        ORDER BY score DESC
        LIMIT :k
    """)
    result = await session.execute(sql, {"q": query, "k": top_k})
    return [dict(r._mapping) for r in result]


async def trigram_search(
    session: AsyncSession,
    query: str,
    top_k: int = 20,
    threshold: float = 0.15,
) -> list[dict]:
    """Fuzzy search via pg_trgm — útil para siglas SAP e erros de grafia."""
    sql = text("""
        SELECT
            id,
            content,
            document_id,
            similarity(content, :q) AS score
        FROM chunks
        WHERE similarity(content, :q) > :thr
        ORDER BY score DESC
        LIMIT :k
    """)
    result = await session.execute(sql, {"q": query, "k": top_k, "thr": threshold})
    return [dict(r._mapping) for r in result]
```

### Critérios de aceite
- [ ] `SELECT * FROM chunks WHERE fts @@ to_tsquery('lançamento')` retorna resultados
- [ ] `SELECT similarity('BKPF', content) FROM chunks ORDER BY 1 DESC LIMIT 3` retorna chunks relevantes
- [ ] FTS com `unaccent` trata "lançamento" e "lancamento" como equivalentes

---

## TASK 7 — Retrieval Híbrido Inicial

### Objetivo
Combinar os três canais de busca (vetorial + FTS + trigram) em uma única função que retorna candidatos para o passo de fusão RRF.

### Arquitetura do retrieval

```
Query do usuário
      │
      ├──► vector_search()   → top-20 por similaridade cosseno
      ├──► fts_search()      → top-20 por ts_rank
      └──► trigram_search()  → top-20 por similarity()
                │
                ▼
         reciprocal_rank_fusion()
                │
                ▼
         top-8 chunks finais
```

### Implementação

```python
# app/retrieval/hybrid.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.ingestion.embedder import generate_embedding


async def vector_search(
    session: AsyncSession,
    query: str,
    top_k: int = 20,
) -> list[dict]:
    embedding = generate_embedding(query)
    sql = text("""
        SELECT
            id,
            content,
            document_id,
            1 - (embedding <=> :emb::vector) AS score
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :emb::vector
        LIMIT :k
    """)
    result = await session.execute(sql, {"emb": str(embedding), "k": top_k})
    return [dict(r._mapping) for r in result]


async def hybrid_search(
    session: AsyncSession,
    query: str,
    top_k: int = 20,
) -> tuple[list[dict], list[dict], list[dict]]:
    """Retorna os 3 conjuntos para fusão posterior."""
    vec  = await vector_search(session, query, top_k)
    fts  = await fts_search(session, query, top_k)
    trgm = await trigram_search(session, query, top_k)
    return vec, fts, trgm
```

### Critérios de aceite
- [ ] Query "lançamento contábil FI" retorna chunks com `score > 0.5`
- [ ] Cada busca retorna lista independente (não vazia se há dados)
- [ ] Tempo total das 3 buscas < 500ms com 10.000 chunks

---

## TASK 8 — Fusão de Resultados com RRF

### Objetivo
Implementar Reciprocal Rank Fusion (RRF) para combinar os rankings dos 3 canais de busca em um único ranking final, sem necessidade de calibração de pesos.

### Como funciona o RRF

Para cada documento em cada lista:

```
rrf_score(d) = Σ  1 / (k + rank(d, lista_i))
              i
```

onde `k = 60` é constante de suavização. Documentos que aparecem em múltiplas listas com bons rankings acumulam score alto.

### Implementação

```python
# app/retrieval/rrf.py
from collections import defaultdict


def reciprocal_rank_fusion(
    result_lists: list[list[dict]],
    k: int = 60,
    top_n: int = 10,
) -> list[dict]:
    """
    Funde N listas ordenadas usando RRF.
    Cada item deve ter campo 'id' (chunk_id).
    """
    scores: dict[int, float] = defaultdict(float)
    items:  dict[int, dict]  = {}

    for result_list in result_lists:
        for rank, item in enumerate(result_list):
            cid = item["id"]
            scores[cid] += 1.0 / (k + rank + 1)
            if cid not in items:
                items[cid] = item

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    return [
        {**items[cid], "rrf_score": round(score, 6)}
        for cid, score in ranked[:top_n]
    ]
```

### Critérios de aceite
- [ ] Chunk que aparece em todas as 3 listas tem `rrf_score` maior que chunk que aparece em apenas 1
- [ ] Resultado final tem no máximo `top_n` itens
- [ ] Sem duplicatas no resultado (mesmo `id` não aparece duas vezes)

---

## TASK 9 — Montagem de Contexto Estruturado

### Objetivo
Orquestrar retrieval híbrido + RRF + busca de entidades para montar o payload de contexto que será enviado à LLM, com informação suficiente para geração de documentação SAP de qualidade.

### Estrutura do contexto de saída

```json
{
  "query": "Como funciona o lançamento contábil no FI?",
  "chunks": [
    {
      "chunk_id": 42,
      "content": "O lançamento contábil no módulo FI...",
      "rrf_score": 0.032,
      "entities": [
        {"tipo": "transacao", "valor": "FB01", "contexto": "..."},
        {"tipo": "tabela",    "valor": "BKPF", "contexto": "..."}
      ]
    }
  ],
  "total_chunks": 8,
  "total_entities": 15
}
```

### Implementação

```python
# app/retrieval/context.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.retrieval.hybrid import hybrid_search
from app.retrieval.rrf import reciprocal_rank_fusion


async def build_context(
    session: AsyncSession,
    query: str,
    top_n: int = 8,
) -> dict:
    # 1. Busca híbrida
    vec, fts, trgm = await hybrid_search(session, query)

    # 2. Fusão RRF
    fused = reciprocal_rank_fusion([vec, fts, trgm], top_n=top_n)

    if not fused:
        return {"query": query, "chunks": [], "total_chunks": 0, "total_entities": 0}

    # 3. Entidades dos chunks recuperados
    chunk_ids = [c["id"] for c in fused]
    ent_result = await session.execute(
        text("""
            SELECT chunk_id, tipo, valor, contexto
            FROM entities
            WHERE chunk_id = ANY(:ids)
            ORDER BY chunk_id, tipo
        """),
        {"ids": chunk_ids},
    )
    entities_by_chunk: dict[int, list] = {}
    for row in ent_result:
        entities_by_chunk.setdefault(row.chunk_id, []).append({
            "tipo":     row.tipo,
            "valor":    row.valor,
            "contexto": row.contexto,
        })

    # 4. Montar payload
    context_blocks = [
        {
            "chunk_id":  c["id"],
            "content":   c["content"],
            "rrf_score": c["rrf_score"],
            "entities":  entities_by_chunk.get(c["id"], []),
        }
        for c in fused
    ]

    total_entities = sum(len(v) for v in entities_by_chunk.values())

    return {
        "query":          query,
        "chunks":         context_blocks,
        "total_chunks":   len(context_blocks),
        "total_entities": total_entities,
    }
```

### Endpoint de teste (sem LLM)

```python
# app/routers/query.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.retrieval.context import build_context

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    top_n: int = 8

@router.post("/")
async def query_rag(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """Retorna contexto estruturado — sem LLM, puro RAG."""
    return await build_context(db, req.query, top_n=req.top_n)
```

### Teste via curl

```powershell
curl -X POST http://localhost:5000/query/ `
  -H "Content-Type: application/json" `
  -d '{"query": "lançamento contábil FB01 BKPF", "top_n": 5}'
```

### Critérios de aceite
- [ ] Resposta contém `chunks` com `rrf_score` decrescente
- [ ] Cada chunk tem `entities` populado (se há entidades na base)
- [ ] Query por sigla SAP ("FB01") retorna chunks relevantes
- [ ] Tempo de resposta < 1 segundo com 10.000 chunks indexados

---

## Checklist Geral de MVP

| # | Task | Critério mínimo | Status |
|---|------|----------------|--------|
| 1 | Schema | Extensões + índices HNSW criados | ⬜ |
| 2 | Parser | PDF → N seções distintas | ⬜ |
| 3 | Chunker | Chunks ≤ 450 tokens com overlap | ⬜ |
| 4 | Entidades | Transações e tabelas SAP extraídas | ⬜ |
| 5 | Embeddings | `chunks.embedding` populado (384 dims) | ⬜ |
| 6 | FTS + Trigram | Busca por "lançamento" retorna resultados | ⬜ |
| 7 | Retrieval | 3 canais funcionando independentemente | ⬜ |
| 8 | RRF | Fusão sem duplicatas, score decrescente | ⬜ |
| 9 | Contexto | JSON estruturado com chunks + entidades | ⬜ |