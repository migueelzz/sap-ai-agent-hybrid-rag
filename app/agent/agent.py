import re

from langgraph.prebuilt import create_react_agent
from langchain_core.messages import ToolMessage
from langchain_openai import ChatOpenAI

from app.agent.memory import get_checkpointer  # sync após init
from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import rag_search, web_search, scrape_url, use_skill, zip_file_explorer
from app.agent.mcp_tools import get_mcp_tools
from app.config import settings

_agent = None

_GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def _resolve_llm() -> ChatOpenAI:
    provider = (settings.llm_provider or "").strip().lower()
    if provider == "google":
        base_url = _GOOGLE_BASE_URL
        # Remove prefixo "gemini/" que é específico do formato LiteLLM
        model = settings.llm_model.removeprefix("gemini/")
    else:
        base_url = settings.llm_base_url or None
        model = settings.llm_model
    return ChatOpenAI(
        model=model,
        api_key=settings.llm_api_key or "no-key",
        base_url=base_url,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
        streaming=True,
    )


# Colapsa runs de 15+ espaços para um único espaço (padding de colunas em tabelas Markdown).
# Reduz tokens desperdiçados em mensagens de ferramentas que o agente recebe de volta.
_EXCESS_SPACES = re.compile(r' {15,}')


def _compress_skill_history(state: dict) -> dict:
    """
    pre_model_hook — executado antes de cada chamada ao LLM.
    Retorna {"llm_input_messages": ...} com ToolMessages de skills antigas
    comprimidas ao título, economizando tokens sem alterar o estado persistido.
    A skill mais recente mantém o conteúdo completo (com espaços excessivos colapsados).
    """
    messages = state.get("messages", [])

    skill_indices = [
        i for i, m in enumerate(messages)
        if isinstance(m, ToolMessage) and getattr(m, 'name', '') == 'use_skill'
    ]
    if not skill_indices:
        return {"llm_input_messages": messages}

    to_compress = set(skill_indices[:-1])  # todas menos a última
    result = []
    for i, msg in enumerate(messages):
        if not isinstance(msg, ToolMessage):
            result.append(msg)
            continue

        content = str(msg.content)
        if i in to_compress:
            # Mantém os primeiros 600 chars para preservar instruções de fluxo/orquestração
            content = content[:600].rstrip() + "\n\n[... conteúdo resumido — skill já processada ...]"
        else:
            # Colapsa padding excessivo de espaços na skill mais recente
            content = _EXCESS_SPACES.sub(' ', content)

        result.append(ToolMessage(
            content=content,
            tool_call_id=msg.tool_call_id,
            name=msg.name,
        ))
    return {"llm_input_messages": result}


async def get_agent():
    """
    Retorna singleton do agente ReAct (LangGraph).
    Agnóstico ao provider — usa ChatOpenAI com base_url customizada,
    compatível com LiteLLM proxy, OpenAI direto, ou qualquer proxy OpenAI-compatible.
    """
    global _agent
    if _agent is None:
        llm = _resolve_llm()
        checkpointer = get_checkpointer()
        tools = [rag_search, web_search, scrape_url, use_skill, zip_file_explorer]
        if settings.mcp_enabled:
            tools += get_mcp_tools()
        _agent = create_react_agent(
            model=llm,
            tools=tools,
            checkpointer=checkpointer,
            prompt=SYSTEM_PROMPT,
            pre_model_hook=_compress_skill_history,
        )
    return _agent
