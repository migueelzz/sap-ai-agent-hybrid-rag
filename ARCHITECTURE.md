# ATEM RAG — Documentação Técnica

**Stack:** Python 3.13 · FastAPI · PostgreSQL + pgvector · SentenceTransformers
**Versão:** 1.0 · **Data:** 2026-03-24

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Banco de Dados](#banco-de-dados)
4. [Pipeline de Ingestão](#pipeline-de-ingestão)
   - [Parser de PDF](#1-parser-de-pdf--appingestionparserpy)
   - [Chunker](#2-chunker--appingestionchunkerpy)
   - [Extrator de Entidades](#3-extrator-de-entidades-sap--appingestionextractorpy)
   - [Embedder](#4-embedder--appingestionembedderpy)
5. [Pipeline de Retrieval](#pipeline-de-retrieval)
   - [Busca Híbrida](#5-busca-híbrida--appretrievalhybridpy)
   - [RRF — Fusão de Resultados](#6-rrf--appretrievalrrfpy)
   - [Montagem de Contexto](#7-montagem-de-contexto--appretrievalcontextpy)
6. [API — Endpoints](#api--endpoints)
   - [Ingestão](#post-ingestpdf)
   - [Query](#post-query)
7. [Configuração e Infraestrutura](#configuração-e-infraestrutura)
8. [Fluxo Completo](#fluxo-completo)

---

## Visão Geral

O ATEM RAG é um sistema de **Retrieval-Augmented Generation** especializado em documentação SAP (módulos FI, CO, MM, SD, PP). Ele transforma manuais PDF em uma base de conhecimento vetorial consultável, permitindo busca semântica precisa sobre conteúdo técnico SAP.

O sistema opera em dois fluxos principais:

| Fluxo | Entrada | Saída |
|-------|---------|-------|
| **Ingestão** | PDF do manual SAP | Chunks indexados com embeddings + entidades extraídas |
| **Query** | Pergunta em linguagem natural | Contexto estruturado com chunks relevantes e entidades SAP |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                      FastAPI App                        │
│                                                         │
│   POST /ingest/pdf          POST /query/                │
│         │                        │                      │
│         ▼                        ▼                      │
│  ┌─────────────┐        ┌──────────────────┐           │
│  │   Ingestão  │        │     Retrieval    │           │
│  │             │        │                  │           │
│  │ parse_pdf() │        │ hybrid_search()  │           │
│  │ build_chunks│        │   vector_search  │           │
│  │ batch_embed │        │   fts_search     │           │
│  │ extract_ent │        │   trigram_search │           │
│  └──────┬──────┘        │       │          │           │
│         │               │  rrf_fusion()    │           │
│         ▼               │       │          │           │
│  ┌─────────────┐        │  build_context() │           │
│  │ PostgreSQL  │◄───────┤       │          │           │
│  │  + pgvector │        └───────┼──────────┘           │
│  └─────────────┘                ▼                      │
│                          JSON estruturado               │
└─────────────────────────────────────────────────────────┘
```

### Estrutura de arquivos

```
app/
├── main.py               # Entrada da aplicação FastAPI
├── config.py             # Configurações via .env (pydantic-settings)
├── database.py           # Engine async SQLAlchemy + sessão
├── ingestion/
│   ├── parser.py         # Extração de seções do PDF
│   ├── chunker.py        # Quebra em chunks semânticos
│   ├── extractor.py      # Extração determinística de entidades SAP
│   └── embedder.py       # Geração de embeddings com SentenceTransformers
├── retrieval/
│   ├── hybrid.py         # Busca vetorial + FTS + trigram
│   ├── rrf.py            # Reciprocal Rank Fusion
│   └── context.py        # Orquestrador — monta o payload final
└── routers/
    ├── ingest.py         # Endpoint POST /ingest/pdf
    └── query.py          # Endpoint POST /query/

scripts/
└── schema.sql            # DDL completo do banco

docs/
└── *.pdf                 # Manuais SAP (FI, MM, PP, SD)
```

---

## Banco de Dados

O banco é PostgreSQL 16 com as extensões `pgvector`, `pg_trgm` e `unaccent`. O schema está em [`scripts/schema.sql`](../scripts/schema.sql).

### Tabelas

#### `sources` — Arquivo de origem
Registra cada PDF ingerido.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | Chave primária |
| `filename` | TEXT UNIQUE | Nome do arquivo PDF |
| `modulo` | TEXT NOT NULL | Módulo SAP: `FI`, `CO`, `MM`, `SD` |
| `release` | TEXT | Versão SAP (ex: `S/4HANA 2023`) |
| `tipo` | TEXT | `pdf` \| `codigo` \| `artefato` |
| `total_pages` | INTEGER | Total de páginas do PDF |

#### `documents` — Seções do PDF
Cada seção/capítulo extraído do PDF vira um registro. Armazena o texto bruto da seção **sem embedding** (o embedding é feito no nível de chunk).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | Chave primária |
| `source_id` | INTEGER NOT NULL | FK para `sources` |
| `title` | TEXT NOT NULL | Título da seção detectado no PDF |
| `page_start` | INTEGER NOT NULL | Página inicial da seção |
| `page_end` | INTEGER NOT NULL | Página final da seção |
| `raw_text` | TEXT NOT NULL | Texto completo da seção (sem embedding) |

#### `chunks` — Unidade de retrieval
Cada chunk é um pedaço de ~400 tokens de um documento. **É aqui que o embedding é gerado e armazenado.**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | Chave primária |
| `document_id` | INTEGER NOT NULL | FK para `documents` |
| `chunk_index` | INTEGER NOT NULL | Posição do chunk dentro do documento |
| `content` | TEXT NOT NULL | Texto do chunk |
| `tokens` | INTEGER | Quantidade aproximada de tokens (palavras) |
| `embedding` | VECTOR(384) | Vetor semântico gerado por MiniLM-L6-v2 |
| `fts` | TSVECTOR (generated) | Índice full-text em português com unaccent |

**Índices:**
- `idx_chunks_embedding` — HNSW (`m=16, ef_construction=64`) para busca vetorial
- `idx_chunks_fts` — GIN para full-text search
- `idx_chunks_trgm` — GIN trigram para busca fuzzy

> **Regra crítica:** embeddings são gerados **somente** para `chunks.content`, nunca para `documents.raw_text`. Um PDF de 200 páginas tem ~150.000 tokens; o modelo suporta ~256 tokens. Gerar embedding do documento inteiro dilui a semântica e torna o retrieval inútil.

#### `entities` — Entidades SAP extraídas
Cada entidade SAP encontrada em um chunk (transações, tabelas, CDS views, termos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | Chave primária |
| `chunk_id` | INTEGER NOT NULL | FK para `chunks` |
| `tipo` | TEXT NOT NULL | `transacao` \| `tabela` \| `cds` \| `termo` |
| `valor` | TEXT NOT NULL | Ex: `FB01`, `BKPF`, `lançamento contábil` |
| `contexto` | TEXT | Trecho do texto ao redor da entidade (±50 chars) |

#### `aliases` — Sinônimos SAP
Mapeamento de termos em português para abreviações SAP.

| termo | alias | modulo |
|-------|-------|--------|
| nota fiscal | NF | MM |
| pedido de compra | PO | MM |
| lançamento contábil | posting | FI |

#### `sap_catalog` — Catálogo de objetos SAP conhecidos
Referência de transações e tabelas SAP com descrições.

| codigo | tipo | descricao | modulo |
|--------|------|-----------|--------|
| FB01 | transacao | Lançar documento | FI |
| BKPF | tabela | Cabeçalho do documento FI | FI |
| ME21N | transacao | Criar pedido de compra | MM |

---

## Pipeline de Ingestão

O pipeline converte um PDF em dados estruturados no banco. Cada etapa transforma a saída da anterior:

```
PDF
 │
 ▼ parse_pdf()
list[ParsedSection]   ← seções por capítulo
 │
 ▼ build_chunks()
list[Chunk]           ← pedaços de ~400 tokens com overlap
 │
 ├─► batch_embeddings()  → list[list[float]]  ← vetores 384D
 └─► extract_entities()  → list[Entity]       ← entidades SAP
 │
 ▼ PostgreSQL
sources → documents → chunks + entities
```

### 1. Parser de PDF — `app/ingestion/parser.py`

**Responsabilidade:** abrir o PDF e dividi-lo em seções por capítulo/título.

#### `ParsedSection`
Dataclass que representa uma seção extraída do PDF:

```python
@dataclass
class ParsedSection:
    title: str                          # título do capítulo detectado
    page_start: int                     # página onde a seção começa
    page_end: int                       # página onde a seção termina
    raw_text: str                       # todo o texto da seção concatenado
    tables: list[list[list[str]]]       # tabelas extraídas (via pdfplumber)
```

#### `_is_title(span) → bool`
Heurística para detectar se um trecho de texto é um título de seção. Um span é considerado título quando **todos** os critérios forem verdadeiros:

| Critério | Condição |
|----------|----------|
| Fonte grande | `size >= 13.0` |
| Negrito | `"Bold"` no nome da fonte **ou** bit 4 do campo `flags` |
| Texto curto | `len < 120 chars` (não é parágrafo longo) |
| Texto não vazio | `len > 3 chars` |

Isso evita classificar títulos corridos ou parágrafos em negrito como seções.

#### `parse_pdf(filepath) → list[ParsedSection]`
Fluxo principal:

1. Abre o PDF com PyMuPDF (`fitz`)
2. Para cada página, itera sobre blocos de texto usando `get_text("dict", flags=TEXT_PRESERVE_WHITESPACE)`
3. Quando encontra um título (`_is_title()`), fecha a seção anterior e abre uma nova
4. Ao final, acrescenta a última seção pendente
5. Chama `_attach_tables()` para enriquecer as seções com tabelas

#### `_attach_tables(filepath, sections)`
Usa `pdfplumber` para extrair tabelas de cada página e as vincula à seção correspondente pelo range de páginas.

---

### 2. Chunker — `app/ingestion/chunker.py`

**Responsabilidade:** quebrar o `raw_text` de cada seção em pedaços menores com overlap, preservando contexto entre chunks adjacentes.

#### Por que 400 tokens com overlap de 60?

| Parâmetro | Valor | Razão |
|-----------|-------|-------|
| `max_tokens` | 400 | MiniLM-L6-v2 suporta ~256 tokens com qualidade máxima; 400 palavras cobre bem uma unidade temática |
| `overlap` | 60 | Preserva contexto entre chunks adjacentes (evita perder uma frase cortada ao meio) |
| Unidade de corte | parágrafo | Respeita limites naturais do texto antes de forçar corte |

#### `_split_paragraphs(text) → list[str]`
Normaliza múltiplas quebras de linha (`\n{3,}` → `\n\n`) e divide o texto por parágrafo (`\n\n`). Retorna lista filtrada (sem strings vazias).

#### `_force_split(text, max_tokens, overlap) → list[str]`
Usado quando um único parágrafo é maior que `max_tokens`. Quebra palavra por palavra com sliding window e overlap:

```
palavras: [w0, w1, ..., w800]
chunk 1:  [w0  ... w399]
chunk 2:  [w340 ... w739]   ← overlap de 60 palavras
chunk 3:  [w680 ... ...]
```

#### `chunk_text(text, max_tokens=400, overlap_tokens=60) → list[str]`
Algoritmo principal:

1. Divide o texto em parágrafos com `_split_paragraphs()`
2. Para cada parágrafo:
   - Se o parágrafo for maior que `max_tokens` → aplica `_force_split()`
   - Se adicioná-lo ultrapassaria `max_tokens` → fecha o chunk atual, inicia novo com overlap
   - Caso contrário → acumula no chunk atual
3. Descarta chunks triviais com menos de 30 caracteres

#### `build_chunks(document_id, raw_text) → list[Chunk]`
Converte a lista de strings retornada por `chunk_text()` em objetos `Chunk`:

```python
@dataclass
class Chunk:
    document_id: int    # FK do documento pai
    chunk_index: int    # posição sequencial (0, 1, 2, ...)
    content: str        # texto do chunk
    tokens: int         # contagem de palavras (aproximação de tokens)
```

---

### 3. Extrator de Entidades SAP — `app/ingestion/extractor.py`

**Responsabilidade:** identificar e extrair objetos SAP do texto de cada chunk usando regex e dicionários, sem LLM.

#### Por que determinístico (sem LLM)?
- **Velocidade:** regex é instantâneo; LLM levaria segundos por chunk
- **Precisão:** objetos SAP têm padrões fixos e bem definidos (`FB01`, `BKPF`, `I_JournalEntry`)
- **Custo zero:** sem chamadas a APIs externas durante ingestão

#### Padrões de extração

**Transações SAP** — `_RE_TRANSACAO`
```python
re.compile(r'\b([A-Z]{1,4}\d{2,4}[A-Z]?)\b')
```
Captura: `FB01`, `ME21N`, `SE16N`, `VA05`, `FS10N`

**CDS Views** — `_RE_CDS`
```python
re.compile(r'\b([IC]_[A-Z][A-Za-z0-9_]{3,})\b')
```
Captura: `I_JournalEntry`, `C_PurchaseOrder`, `I_SalesDocument`

**Tabelas SAP conhecidas** — `_TODOS_TABELAS`
Não usa regex genérico (produziria muitos falsos positivos). Verifica cada palavra do chunk contra um dicionário de tabelas conhecidas por módulo:

```python
_TABELAS_SAP = {
    "FI": {"BKPF", "BSEG", "SKA1", "SKB1", "T001", "T030"},
    "MM": {"EKKO", "EKPO", "MARA", "MARC", "MAKT", "T024"},
    "SD": {"VBAK", "VBAP", "LIKP", "LIPS", "VBRK", "VBRP"},
    "CO": {"COSP", "COSS", "CSKS", "CSKT", "AUFK"},
}
```

**Termos em português** — `_TERMOS`
Busca textual por termos técnicos SAP no idioma PT-BR, organizados por módulo:

| Módulo | Exemplos de termos |
|--------|-------------------|
| FI | lançamento contábil, partida dupla, plano de contas, balancete |
| CO | centro de custo, ordem interna, rateio, controlling |
| MM | pedido de compra, nota fiscal, requisição de compra |
| SD | pedido de venda, faturamento, condição de preço |

#### `extract_entities(chunk_id, content) → list[Entity]`
Retorna entidades deduplicadas por `(tipo, valor)`. A deduplicação evita registrar `FB01` como transação múltiplas vezes se ela aparece mais de uma vez no chunk.

Cada entidade tem um `contexto` — 50 caracteres antes e depois da ocorrência — que serve como evidência para o LLM durante a geração.

---

### 4. Embedder — `app/ingestion/embedder.py`

**Responsabilidade:** converter texto em vetores de 384 dimensões usando o modelo `paraphrase-MiniLM-L6-v2` local (sem GPU, sem API).

#### Modelo: `paraphrase-MiniLM-L6-v2`

| Característica | Valor |
|----------------|-------|
| Dimensões | 384 |
| Janela de contexto | ~256 tokens |
| Tamanho | ~80MB |
| Hardware | CPU (sem GPU necessária) |
| Idioma | Multilíngue (português incluído) |

#### `_get_model() → SentenceTransformer`
Decorado com `@lru_cache(maxsize=1)` para garantir que o modelo seja carregado **uma única vez** por processo. Sem o cache, cada requisição recarregaria os ~80MB do modelo.

#### `normalize_text(text) → str`
Pipeline de normalização aplicado antes de gerar o embedding:

```
texto original
     ↓ lowercase
     ↓ remove pontuação
     ↓ remove espaços múltiplos
     ↓ remove stopwords portuguesas (NLTK)
     ↓ stemming (SnowballStemmer — português)
texto normalizado
```

Isso melhora a qualidade dos embeddings para textos técnicos SAP em português, onde stopwords ("o", "a", "de", "para") não contribuem para a semântica.

#### `generate_embedding(text) → list[float]`
Gera embedding para um único texto. Retorna lista de 384 floats. **Use `batch_embeddings()` durante ingestão** — esta função é para queries individuais.

Usa `normalize_embeddings=True` para normalizar o vetor na esfera unitária, o que melhora a similaridade cosseno.

#### `batch_embeddings(texts, batch_size=64) → list[list[float]]`
Processa múltiplos textos de forma eficiente em lotes de 64. Exibe barra de progresso durante ingestão.

---

## Pipeline de Retrieval

O retrieval combina três estratégias de busca independentes e as funde com RRF para maximizar cobertura e precisão.

```
Query do usuário
      │
      ├──► vector_search()   → top-20 por similaridade cosseno (semântica)
      ├──► fts_search()      → top-20 por ts_rank_cd (palavras exatas)
      └──► trigram_search()  → top-20 por similarity() (fuzzy, erros)
                │
                ▼
         reciprocal_rank_fusion()
                │
                ▼
         top-N chunks finais + entidades associadas
                │
                ▼
         build_context() → JSON estruturado
```

### Por que três estratégias?

| Estratégia | Boa para | Ruim para |
|------------|---------|-----------|
| Vetorial | Semântica, sinônimos, paráfrases | Siglas exatas, nomes de tabelas |
| FTS | Palavras exatas, stemming | Erros ortográficos, abreviações |
| Trigram | Erros de digitação, siglas parciais | Performance em tabelas grandes |

Combinando os três: **cobertura máxima** com custo computacional aceitável.

---

### 5. Busca Híbrida — `app/retrieval/hybrid.py`

#### `vector_search(session, query, top_k=20) → list[dict]`
Busca semântica usando pgvector.

1. Normaliza a query e gera embedding com `generate_embedding()`
2. Executa busca por distância cosseno (`<=>`) com operador HNSW
3. Filtra apenas chunks com embedding (`WHERE embedding IS NOT NULL`)
4. Retorna os `top_k` mais similares com `score = 1 - distância_cosseno`

```sql
SELECT id, content, document_id,
       1 - (embedding <=> CAST(:emb AS vector)) AS score
FROM chunks
WHERE embedding IS NOT NULL
ORDER BY embedding <=> CAST(:emb AS vector)
LIMIT :k
```

> **Nota:** o cast `CAST(:emb AS vector)` é necessário porque o driver asyncpg usa parâmetros posicionais (`$1`) e o operador `::vector` do PostgreSQL interfere com a sintaxe de parâmetro nomeado do SQLAlchemy.

#### `fts_search(session, query, top_k=20) → list[dict]`
Full-text search com suporte nativo a operadores (`AND`, `OR`, aspas para frase exata).

```sql
SELECT id, content, document_id,
       ts_rank_cd(fts, websearch_to_tsquery('portuguese', unaccent(:q))) AS score
FROM chunks
WHERE fts @@ websearch_to_tsquery('portuguese', unaccent(:q))
ORDER BY score DESC
LIMIT :k
```

- `websearch_to_tsquery` interpreta a query em linguagem natural (ex: `"lançamento contábil" OR FB01`)
- `unaccent()` torna a busca insensível a acentos: `"lançamento"` encontra `"lancamento"` e vice-versa
- `ts_rank_cd` ranqueia por cobertura de termos no documento

#### `trigram_search(session, query, top_k=20, threshold=0.15) → list[dict]`
Busca fuzzy via similaridade de trigramas. Útil para siglas SAP (`ME21` encontra `ME21N`) e erros de digitação.

```sql
SELECT id, content, document_id,
       similarity(content, :q) AS score
FROM chunks
WHERE similarity(content, :q) > :thr
ORDER BY score DESC
LIMIT :k
```

- Threshold padrão `0.15` é permissivo o suficiente para capturar variações, mas descarta resultados completamente irrelevantes

#### `hybrid_search(session, query, top_k=20) → tuple`
Wrapper que chama as três buscas em sequência e retorna as três listas para fusão:

```python
vec, fts, trgm = await hybrid_search(session, query)
```

---

### 6. RRF — `app/retrieval/rrf.py`

**Responsabilidade:** combinar N listas de resultados ranqueados em um único ranking final, sem necessidade de calibrar pesos.

#### Como funciona o Reciprocal Rank Fusion

Para cada chunk em cada lista de resultados:

```
rrf_score(chunk) = Σ  1 / (k + rank(chunk, lista_i))
                   i
```

Onde:
- `k = 60` é a constante de suavização (reduz o impacto excessivo da posição 1)
- `rank` começa em 0

**Exemplo:** um chunk que aparece como 1º nos três canais:

```
score = 1/(60+0+1) + 1/(60+0+1) + 1/(60+0+1) = 3/61 ≈ 0.049
```

Um chunk que aparece como 1º em apenas um canal:

```
score = 1/(60+0+1) ≈ 0.016
```

Chunks que aparecem em **múltiplos canais** com bons rankings acumulam score alto. Isso favorece resultados com cobertura ampla.

#### `reciprocal_rank_fusion(result_lists, k=60, top_n=10) → list[dict]`

```python
def reciprocal_rank_fusion(result_lists, k=60, top_n=10):
    scores = defaultdict(float)
    items  = {}

    for result_list in result_lists:
        for rank, item in enumerate(result_list):
            cid = item["id"]
            scores[cid] += 1.0 / (k + rank + 1)
            if cid not in items:     # preserva dados do primeiro canal que encontrou
                items[cid] = item

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [{**items[cid], "rrf_score": round(score, 6)} for cid, score in ranked[:top_n]]
```

**Garantias:**
- Sem duplicatas no resultado (mesmo `id` não aparece duas vezes)
- `rrf_score` decrescente
- No máximo `top_n` itens

---

### 7. Montagem de Contexto — `app/retrieval/context.py`

**Responsabilidade:** orquestrar todo o retrieval e montar o payload final estruturado que será enviado à LLM (ou retornado diretamente ao cliente).

#### `build_context(session, query, top_n=8) → dict`

**Fluxo:**

```
1. hybrid_search()          → (vec_results, fts_results, trgm_results)
2. reciprocal_rank_fusion() → top-N chunks fundidos
3. SELECT FROM entities     → entidades dos chunks recuperados
4. Montar payload JSON      → { query, chunks[], total_chunks, total_entities }
```

**Guard de resultado vazio:**
```python
if not fused:
    return {"query": query, "chunks": [], "total_chunks": 0, "total_entities": 0}
```

**Estrutura do retorno:**
```json
{
  "query": "Como funciona o lançamento contábil no FI?",
  "chunks": [
    {
      "chunk_id": 42,
      "content": "O lançamento contábil no módulo FI é o processo de...",
      "rrf_score": 0.032154,
      "entities": [
        {"tipo": "transacao", "valor": "FB01", "contexto": "...usar a transação FB01 para..."},
        {"tipo": "tabela",    "valor": "BKPF", "contexto": "...gravado na tabela BKPF com..."}
      ]
    }
  ],
  "total_chunks": 8,
  "total_entities": 15
}
```

---

## API — Endpoints

### `POST /ingest/pdf`

Ingere um PDF no sistema. Executa o pipeline completo de parsing → chunking → embedding → extração de entidades → persistência.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `file` | UploadFile | ✅ | — | Arquivo PDF |
| `modulo` | string (query) | ❌ | `FI` | Módulo SAP do documento |

**Resposta de sucesso (200):**
```json
{
  "source_id": 1,
  "documents": 23,
  "chunks": 487
}
```

**Fluxo interno do endpoint:**

```python
# 1. Salva PDF em arquivo temporário
# 2. Registra em sources (filename, modulo)
# 3. parse_pdf() → list[ParsedSection]
# 4. Para cada seção:
#    a. INSERT INTO documents
#    b. build_chunks() → list[Chunk]
#    c. batch_embeddings() → list[vector]
#    d. Para cada chunk:
#       - INSERT INTO chunks (com CAST(:emb AS vector))
#       - extract_entities()
#       - INSERT INTO entities (para cada entidade)
# 5. db.commit()
# 6. Remove arquivo temporário (finally)
```

**Exemplo:**
```powershell
curl -X POST "http://localhost:5000/ingest/pdf?modulo=FI" `
  -F "file=@docs/Manual_SAP_ECC_S4HANA_FI_ContabilidadeFinanceira_2025-06-06.pdf"
```

---

### `POST /query/`

Executa uma busca híbrida e retorna o contexto estruturado com os chunks mais relevantes e suas entidades SAP.

**Body (JSON):**

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|-------------|--------|-----------|
| `query` | string | ✅ | — | Pergunta ou termo de busca |
| `top_n` | integer | ❌ | `8` | Número máximo de chunks no resultado |

**Resposta de sucesso (200):**
```json
{
  "query": "lançamento contábil FB01 BKPF",
  "chunks": [ ... ],
  "total_chunks": 5,
  "total_entities": 12
}
```

**Exemplo:**
```powershell
curl -X POST http://localhost:5000/query/ `
  -H "Content-Type: application/json" `
  -d '{"query": "lançamento contábil FB01", "top_n": 5}'
```

---

### `GET /health`

Verifica se a API está no ar.

**Resposta:**
```json
{"status": "ok"}
```

---

## Configuração e Infraestrutura

### `app/config.py`

Configurações carregadas do arquivo `.env` via `pydantic-settings`:

```python
class Settings(BaseSettings):
    database_url: str              # postgresql+asyncpg://...
    postgres_user: str             # padrão: "atem"
    postgres_password: str         # padrão: "atem_secret"
    postgres_db: str               # padrão: "atem_rag"
    postgres_host: str             # padrão: "localhost"
    postgres_port: int             # padrão: 5432
    openai_api_key: str = ""       # opcional — para uso com LLM
    embedding_model: str           # padrão: "paraphrase-MiniLM-L6-v2"
```

### `app/database.py`

Conexão assíncrona com PostgreSQL usando SQLAlchemy 2.0:

```python
engine = create_async_engine(settings.database_url, echo=False)
AsyncSession = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSession() as session:
        yield session          # injeção de dependência FastAPI
```

### `.env.example`

```
DATABASE_URL=postgresql+asyncpg://atem:atem_secret@localhost:5432/atem_rag
OPENAI_API_KEY=           # deixar vazio para rodar sem LLM
EMBEDDING_MODEL=paraphrase-MiniLM-L6-v2
```

### `docker-compose.yml`

Sobe o PostgreSQL 16 com pgvector:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: atem
      POSTGRES_PASSWORD: atem_secret
      POSTGRES_DB: atem_rag
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
```

**Iniciar banco:**
```powershell
docker compose up -d
```

**Aplicar schema:**
```powershell
docker exec -i <container_name> psql -U atem atem_rag < scripts/schema.sql
```

**Iniciar API:**
```powershell
pdm run uvicorn app.main:app --reload --port 5000
```

---

## Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTÃO                                  │
│                                                                  │
│  PDF (200 páginas)                                               │
│       │                                                          │
│       ▼ parse_pdf()   [PyMuPDF + pdfplumber]                    │
│  list[ParsedSection]  (23 seções, ~10 páginas cada)             │
│       │                                                          │
│       ▼ build_chunks()  [400 tokens, overlap 60]                │
│  list[Chunk]          (487 chunks, ~400 tokens cada)            │
│       │                                                          │
│       ├──► batch_embeddings()  → 487 vetores de 384 floats      │
│       └──► extract_entities()  → ~2000 entidades SAP            │
│       │                                                          │
│       ▼ PostgreSQL INSERT                                        │
│  sources(1) → documents(23) → chunks(487) + entities(~2000)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         QUERY                                    │
│                                                                  │
│  "Como fazer lançamento contábil no FI?"                        │
│       │                                                          │
│       ▼ hybrid_search()                                          │
│  ┌────┴──────────────────────────────────┐                       │
│  │ vector_search()  → 20 chunks (cosine) │                       │
│  │ fts_search()     → 20 chunks (FTS)    │                       │
│  │ trigram_search() → 20 chunks (fuzzy)  │                       │
│  └────┬──────────────────────────────────┘                       │
│       │                                                          │
│       ▼ reciprocal_rank_fusion()                                 │
│  top-8 chunks (score combinado, sem duplicatas)                  │
│       │                                                          │
│       ▼ SELECT entities WHERE chunk_id IN (...)                  │
│  entidades SAP dos chunks recuperados                            │
│       │                                                          │
│       ▼ build_context()                                          │
│  {                                                               │
│    "query": "...",                                               │
│    "chunks": [{ content, rrf_score, entities[] }],              │
│    "total_chunks": 8,                                            │
│    "total_entities": 15                                          │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```
