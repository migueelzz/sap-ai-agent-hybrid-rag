from datetime import datetime
from pydantic import BaseModel


class CreateSessionResponse(BaseModel):
    session_id: str
    created_at: datetime


class MessageRequest(BaseModel):
    message: str


class MessageChunk(BaseModel):
    """Unidade de dado enviada via SSE ao cliente."""
    type: str           # "token" | "tool_start" | "tool_end" | "error" | "done"
    content: str
    tool_name: str | None = None


class HistoryMessage(BaseModel):
    role: str           # "human" | "assistant" | "tool"
    content: str


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]
