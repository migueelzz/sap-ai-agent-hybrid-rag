from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

from app.agent.memory import get_checkpointer  # sync após init
from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import rag_search, build_web_search_tool
from app.config import settings

_agent = None


async def get_agent():
    """
    Retorna singleton do agente ReAct (LangGraph).
    Agnóstico ao provider — usa ChatOpenAI com base_url customizada,
    compatível com LiteLLM proxy, OpenAI direto, ou qualquer proxy OpenAI-compatible.
    """
    global _agent
    if _agent is None:
        llm = ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.llm_api_key or "no-key",
            base_url=settings.llm_base_url or None,
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
            streaming=True,
        )
        checkpointer = get_checkpointer()
        _agent = create_react_agent(
            model=llm,
            tools=[rag_search, build_web_search_tool()],
            checkpointer=checkpointer,
            prompt=SYSTEM_PROMPT,
        )
    return _agent
