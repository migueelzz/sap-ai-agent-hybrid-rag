import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.agent import get_agent
from app.agent.context_var import db_session_var
from app.agent.memory import get_checkpointer
from app.database import get_db
from app.models.chat import (
    CreateSessionResponse,
    HistoryMessage,
    HistoryResponse,
    MessageChunk,
    MessageRequest,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /chat/sessions — cria nova sessão
# ---------------------------------------------------------------------------

@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session():
    return CreateSessionResponse(
        session_id=str(uuid.uuid4()),
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# POST /chat/{session_id}/message — envia mensagem (streaming SSE)
# ---------------------------------------------------------------------------

async def _stream_agent(
    session_id: str,
    message: str,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    token = db_session_var.set(db)
    try:
        agent = await get_agent()
        config = {"configurable": {"thread_id": session_id}}
        input_state = {"messages": [HumanMessage(content=message)]}

        async for event in agent.astream_events(input_state, config=config, version="v2"):
            event_type = event.get("event", "")

            if event_type == "on_chat_model_stream":
                chunk = event["data"].get("chunk")
                if chunk and chunk.content:
                    payload = MessageChunk(type="token", content=chunk.content)
                    yield f"data: {payload.model_dump_json()}\n\n"

            elif event_type == "on_tool_start":
                tool_name = event.get("name", "")
                payload = MessageChunk(type="tool_start", content="", tool_name=tool_name)
                yield f"data: {payload.model_dump_json()}\n\n"

            elif event_type == "on_tool_end":
                tool_name = event.get("name", "")
                output = str(event["data"].get("output", ""))[:2000]
                payload = MessageChunk(type="tool_end", content=output, tool_name=tool_name)
                yield f"data: {payload.model_dump_json()}\n\n"

        yield f"data: {MessageChunk(type='done', content='').model_dump_json()}\n\n"

    except Exception as exc:
        payload = MessageChunk(type="error", content=str(exc))
        yield f"data: {payload.model_dump_json()}\n\n"
    finally:
        db_session_var.reset(token)


@router.post("/{session_id}/message")
async def send_message(
    session_id: str,
    req: MessageRequest,
    db: AsyncSession = Depends(get_db),
):
    return StreamingResponse(
        _stream_agent(session_id, req.message, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# GET /chat/{session_id}/history — retorna histórico persistido
# ---------------------------------------------------------------------------

def _msg_to_model(msg) -> HistoryMessage:
    if isinstance(msg, HumanMessage):
        role = "human"
    elif isinstance(msg, AIMessage):
        role = "assistant"
    elif isinstance(msg, ToolMessage):
        role = "tool"
    else:
        role = "unknown"

    content = msg.content if isinstance(msg.content, str) else str(msg.content)
    return HistoryMessage(role=role, content=content)


@router.get("/{session_id}/history", response_model=HistoryResponse)
async def get_history(session_id: str):
    checkpointer = get_checkpointer()
    config = {"configurable": {"thread_id": session_id}}
    checkpoint = await checkpointer.aget(config)

    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")

    messages = checkpoint.get("channel_values", {}).get("messages", [])
    return HistoryResponse(
        session_id=session_id,
        messages=[_msg_to_model(m) for m in messages],
    )


# ---------------------------------------------------------------------------
# DELETE /chat/{session_id} — encerra sessão
# ---------------------------------------------------------------------------

@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str):
    # O histórico permanece no PostgreSQL até limpeza manual.
    # Para remover: DELETE FROM checkpoints WHERE thread_id = session_id
    return None
