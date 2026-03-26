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
            chunk_index,
            1 - (embedding <=> CAST(:emb AS vector)) AS score
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:emb AS vector)
        LIMIT :k
    """)
    result = await session.execute(sql, {"emb": str(embedding), "k": top_k})
    return [dict(r._mapping) for r in result]


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
            chunk_index,
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
            chunk_index,
            similarity(content, :q) AS score
        FROM chunks
        WHERE similarity(content, :q) > :thr
        ORDER BY score DESC
        LIMIT :k
    """)
    result = await session.execute(sql, {"q": query, "k": top_k, "thr": threshold})
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
