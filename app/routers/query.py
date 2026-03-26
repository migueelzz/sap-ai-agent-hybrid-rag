from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.retrieval.context import build_context

router = APIRouter()


class QueryRequest(BaseModel):
    query: str
    top_n: int = 8          # chunks going into RRF fusion
    window_size: int = 1    # neighbors to add on each side of anchor chunks


@router.post("/")
async def query_rag(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """Retorna contexto estruturado agrupado por documento — RAG puro sem LLM."""
    return await build_context(db, req.query, top_n=req.top_n, window_size=req.window_size)
