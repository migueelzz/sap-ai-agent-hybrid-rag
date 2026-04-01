import re

from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_openai import ChatOpenAI

from app.agent.memory import get_checkpointer  # sync após init
from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import rag_search, web_search, scrape_url, use_skill, zip_file_explorer, write_output_file
from app.agent.mcp_tools import get_mcp_tools
from app.config import settings

_agent = None

_GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def _resolve_llm() -> ChatOpenAI:
    provider = (settings.llm_provider or "").strip().lower()
    if provider == "google":
        base_url = _GOOGLE_BASE_URL
        model = settings.llm_model.removeprefix("gemini/")
    else:
        base_url = settings.llm_base_url or None
        model = settings.llm_model

    extra_kwargs: dict = {}
    if settings.llm_thinking_budget > 0:
        if provider == "google":
            # Google AI API (direto): usa thinkingConfig no body da requisição
            extra_kwargs["model_kwargs"] = {
                "thinkingConfig": {"thinkingBudget": settings.llm_thinking_budget}
            }
        else:
            # LiteLLM proxy: passa thinking via extra_body (OpenAI SDK ≥ 1.x)
            extra_kwargs["extra_body"] = {
                "thinking": {"type": "enabled", "budget_tokens": settings.llm_thinking_budget}
            }

    return ChatOpenAI(
        model=model,
        api_key=settings.llm_api_key or "no-key",
        base_url=base_url,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
        streaming=True,
        max_retries=0,  # falha rápida — sem retry automático no proxy LiteLLM
        **extra_kwargs,
    )


# Colapsa runs de 15+ espaços para um único espaço (padding de colunas em tabelas Markdown).
# Reduz tokens desperdiçados em mensagens de ferramentas que o agente recebe de volta.
_EXCESS_SPACES = re.compile(r' {15,}')


def _compress_skill_history(state: dict) -> dict:
    """
    pre_model_hook — executado antes de cada chamada ao LLM.

    Aplica duas otimizações de tokens sem alterar o estado persistido no checkpointer:

    1. Janela deslizante: mantém apenas as últimas `max_history_messages` mensagens,
       iniciando sempre em um HumanMessage (evita corte no meio de um turno).
       Garante custo linear em vez de quadrático conforme a conversa cresce.

    2. Compressão de skills antigas: ToolMessages de use_skill anteriores à mais
       recente são truncadas a 600 chars, preservando instruções de orquestração
       mas descartando o conteúdo completo já processado.
    """
    messages = state.get("messages", [])

    # 1. Janela deslizante (não altera checkpointer)
    limit = settings.max_history_messages
    if len(messages) > limit:
        trimmed = messages[-limit:]
        # Garantir que não cortamos no meio de um turno — iniciar em HumanMessage
        first_human = next(
            (i for i, m in enumerate(trimmed) if isinstance(m, HumanMessage)), 0
        )
        messages = trimmed[first_human:]

    # 2. Compressão de skills antigas
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
        tools = [rag_search, web_search, scrape_url, use_skill, zip_file_explorer, write_output_file]
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
