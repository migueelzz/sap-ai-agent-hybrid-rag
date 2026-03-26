from collections import defaultdict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.retrieval.hybrid import hybrid_search
from app.retrieval.rrf import reciprocal_rank_fusion


async def build_context(
    session: AsyncSession,
    query: str,
    top_n: int = 8,
    window_size: int = 1,
) -> dict:
    # 1. Busca híbrida
    vec, fts, trgm = await hybrid_search(session, query)

    # 2. Fusão RRF
    fused = reciprocal_rank_fusion([vec, fts, trgm], top_n=top_n)

    if not fused:
        return {"query": query, "documents": [], "total_documents": 0, "total_chunks": 0, "total_entities": 0}

    # 3. Agrupar anchors por documento
    anchor_by_doc: dict[int, list[dict]] = defaultdict(list)
    for chunk in fused:
        anchor_by_doc[chunk["document_id"]].append(chunk)

    # Rankear documentos por soma dos rrf_scores
    doc_scores = {
        doc_id: sum(c["rrf_score"] for c in chunks)
        for doc_id, chunks in anchor_by_doc.items()
    }
    ranked_doc_ids = sorted(doc_scores, key=lambda d: doc_scores[d], reverse=True)

    # 4. Calcular índices necessários por documento (anchors ± window_size)
    needed_indices: dict[int, set[int]] = {}
    for doc_id, chunks in anchor_by_doc.items():
        anchor_idxs = {c["chunk_index"] for c in chunks}
        expanded = set()
        for idx in anchor_idxs:
            for delta in range(-window_size, window_size + 1):
                expanded.add(idx + delta)
        needed_indices[doc_id] = expanded

    # 5. Buscar todos os chunks necessários (anchors + vizinhos) num único query
    all_chunks_result = await session.execute(
        text("""
            SELECT id, content, document_id, chunk_index
            FROM chunks
            WHERE document_id = ANY(:doc_ids)
        """),
        {"doc_ids": ranked_doc_ids},
    )
    # Indexar por (document_id, chunk_index)
    fetched: dict[tuple[int, int], dict] = {}
    for row in all_chunks_result:
        fetched[(row.document_id, row.chunk_index)] = {
            "id": row.id,
            "content": row.content,
            "document_id": row.document_id,
            "chunk_index": row.chunk_index,
        }

    # 6. Buscar títulos dos documentos
    doc_titles_result = await session.execute(
        text("SELECT id, title FROM documents WHERE id = ANY(:doc_ids)"),
        {"doc_ids": ranked_doc_ids},
    )
    doc_titles: dict[int, str] = {row.id: row.title for row in doc_titles_result}

    # 7. Montar conjunto final de chunk ids (para buscar entidades)
    anchor_ids: dict[int, float] = {c["id"]: c["rrf_score"] for c in fused}
    all_chunk_ids: list[int] = []
    for doc_id in ranked_doc_ids:
        for idx in needed_indices[doc_id]:
            row = fetched.get((doc_id, idx))
            if row:
                all_chunk_ids.append(row["id"])

    # 8. Buscar entidades para todos os chunks
    ent_result = await session.execute(
        text("""
            SELECT chunk_id, tipo, valor, contexto
            FROM entities
            WHERE chunk_id = ANY(:ids)
            ORDER BY chunk_id, tipo
        """),
        {"ids": all_chunk_ids},
    )
    entities_by_chunk: dict[int, list] = {}
    for row in ent_result:
        entities_by_chunk.setdefault(row.chunk_id, []).append({
            "tipo":     row.tipo,
            "valor":    row.valor,
            "contexto": row.contexto,
        })

    # 9. Montar payload agrupado por documento
    documents = []
    total_chunks = 0
    total_entities = 0

    for doc_id in ranked_doc_ids:
        sorted_indices = sorted(needed_indices[doc_id])
        chunks_out = []
        for idx in sorted_indices:
            row = fetched.get((doc_id, idx))
            if not row:
                continue
            cid = row["id"]
            is_anchor = cid in anchor_ids
            chunk_entities = entities_by_chunk.get(cid, [])
            chunks_out.append({
                "chunk_id":    cid,
                "chunk_index": idx,
                "content":     row["content"],
                "rrf_score":   anchor_ids[cid] if is_anchor else None,
                "is_anchor":   is_anchor,
                "entities":    chunk_entities,
            })
            total_entities += len(chunk_entities)

        if chunks_out:
            documents.append({
                "document_id":    doc_id,
                "document_title": doc_titles.get(doc_id, ""),
                "doc_score":      round(doc_scores[doc_id], 6),
                "chunks":         chunks_out,
            })
            total_chunks += len(chunks_out)

    return {
        "query":            query,
        "documents":        documents,
        "total_documents":  len(documents),
        "total_chunks":     total_chunks,
        "total_entities":   total_entities,
    }
