from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import tempfile, os

from app.database import get_db
from app.ingestion.parser import parse_pdf, ParsedSection
from app.ingestion.chunker import build_chunks
from app.ingestion.embedder import batch_embeddings
from app.ingestion.extractor import extract_entities

router = APIRouter()

@router.post("/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    modulo: str = "FI",
    db: AsyncSession = Depends(get_db),
):
    # 1. Salvar temporariamente
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # 2. Registrar source
        src = await db.execute(
            text("INSERT INTO sources(filename, modulo) VALUES(:f, :m) RETURNING id"),
            {"f": file.filename, "m": modulo},
        )
        source_id = src.scalar()

        # 3. Parsear PDF
        parsed_docs = parse_pdf(tmp_path)
        total_chunks = 0

        for doc in parsed_docs:
            # 4. Inserir documento
            doc_row = await db.execute(
                text("""
                    INSERT INTO documents(source_id, title, page_start, page_end, raw_text)
                    VALUES(:sid, :t, :ps, :pe, :rt) RETURNING id
                """),
                {"sid": source_id, "t": doc.title,
                 "ps": doc.page_start, "pe": doc.page_end, "rt": doc.raw_text},
            )
            doc_id = doc_row.scalar()

            # 5. Chunking
            chunks = build_chunks(doc_id, doc.raw_text)

            # 6. Embeddings em batch
            embeddings = batch_embeddings([c.content for c in chunks])

            # 7. Persistir chunks + entidades
            for chunk, emb in zip(chunks, embeddings):
                chunk_row = await db.execute(
                    text("""
                        INSERT INTO chunks(document_id, chunk_index, content, embedding, tokens)
                        VALUES(:did, :ci, :ct, CAST(:emb AS vector), :tk) RETURNING id
                    """),
                    {
                        "did": doc_id, "ci": chunk.chunk_index,
                        "ct": chunk.content, "emb": str(emb), "tk": chunk.tokens,
                    },
                )
                chunk_id = chunk_row.scalar()
                entities = extract_entities(chunk_id, chunk.content)
                for ent in entities:
                    await db.execute(
                        text("""
                            INSERT INTO entities(chunk_id, tipo, valor, contexto)
                            VALUES(:cid, :tp, :vl, :ctx)
                        """),
                        {"cid": chunk_id, "tp": ent.tipo, "vl": ent.valor, "ctx": ent.contexto},
                    )
                total_chunks += 1

        await db.commit()
        return {"source_id": source_id, "documents": len(parsed_docs), "chunks": total_chunks}

    finally:
        os.unlink(tmp_path)