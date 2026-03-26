from contextvars import ContextVar
from sqlalchemy.ext.asyncio import AsyncSession

# Transporta a AsyncSession do request FastAPI até as tools LangGraph.
# LangGraph chama tools via await no mesmo Task asyncio, então o var é herdado.
db_session_var: ContextVar[AsyncSession | None] = ContextVar("db_session", default=None)
