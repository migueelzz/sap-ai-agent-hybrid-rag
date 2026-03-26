from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ingest, query, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.agent.memory import init_checkpointer, close_checkpointer
    from app.agent.agent import get_agent

    await init_checkpointer()
    await get_agent()
    yield
    await close_checkpointer()


app = FastAPI(title="ATEM RAG API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ingest", tags=["Ingestão"])
app.include_router(query.router,  prefix="/query",  tags=["Query"])
app.include_router(chat.router,   prefix="/chat",   tags=["Chat"])


@app.get("/")
async def health():
    return {"status": "ok", "docs": "/docs"}
