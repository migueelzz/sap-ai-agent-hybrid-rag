-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE por padrão; wrapper necessário para colunas GENERATED
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$SELECT unaccent('unaccent'::regdictionary, $1)$$;

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
                        to_tsvector('portuguese', immutable_unaccent(content))
                    ) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índice vetorial HNSW
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

CREATE INDEX idx_entities_chunk ON entities(chunk_id);
CREATE INDEX idx_entities_valor ON entities USING gin(valor gin_trgm_ops);
CREATE INDEX idx_entities_tipo  ON entities(tipo);

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

INSERT INTO aliases(termo, alias, modulo) VALUES
    ('nota fiscal',         'NF',      'MM'),
    ('pedido de compra',    'PO',      'MM'),
    ('ordem de venda',      'SO',      'SD'),
    ('lançamento contábil', 'posting', 'FI'),
    ('centro de custo',     'CC',      'CO'),
    ('documento contábil',  'FI doc',  'FI');

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

INSERT INTO sap_catalog(tipo, codigo, descricao, modulo) VALUES
    ('transacao', 'FB01',  'Lançar documento',           'FI'),
    ('transacao', 'FB50',  'Lançar documento G/L',       'FI'),
    ('transacao', 'FS10N', 'Saldo da conta G/L',         'FI'),
    ('tabela',    'BKPF',  'Cabeçalho do documento FI',  'FI'),
    ('tabela',    'BSEG',  'Posições do documento FI',   'FI'),
    ('transacao', 'ME21N', 'Criar pedido de compra',     'MM'),
    ('tabela',    'EKKO',  'Cabeçalho do pedido',        'MM'),
    ('tabela',    'EKPO',  'Posições do pedido',         'MM');
