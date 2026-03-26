from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun

from app.agent.context_var import db_session_var
from app.retrieval.context import build_context


# ---------------------------------------------------------------------------
# Ferramenta 1 — RAG Search
# ---------------------------------------------------------------------------

def _format_context(ctx: dict) -> str:
    """Converte o dict de build_context em texto legível para o LLM (~3000 tokens máx)."""
    if not ctx["documents"]:
        return "Nenhum resultado encontrado na base de conhecimento para esta consulta."

    parts: list[str] = [f"**Consulta:** {ctx['query']}\n"]
    char_budget = 12_000  # ~3000 tokens

    for doc in ctx["documents"]:
        title = doc["document_title"] or f"Documento #{doc['document_id']}"
        parts.append(f"\n### {title}")

        for chunk in doc["chunks"]:
            if not chunk["is_anchor"]:
                continue  # inclui apenas chunks âncora para reduzir tamanho
            content = chunk["content"][:600]  # trunca chunks longos
            parts.append(content)

            entities = chunk.get("entities", [])
            if entities:
                vals = ", ".join(e["valor"] for e in entities[:10])
                parts.append(f"*Entidades SAP:* {vals}")

        text_so_far = "\n".join(parts)
        if len(text_so_far) > char_budget:
            break

    return "\n".join(parts)


@tool
async def rag_search(query: str) -> str:
    """Busca na base de conhecimento SAP interna (manuais ATEM). Use esta ferramenta primeiro para qualquer pergunta sobre SAP."""
    session = db_session_var.get()
    if session is None:
        return "Erro interno: sessão de banco de dados não disponível."
    ctx = await build_context(session, query, top_n=8, window_size=1)
    return _format_context(ctx)


# ---------------------------------------------------------------------------
# Ferramenta 2 — Web Search (DuckDuckGo, sem API key)
# ---------------------------------------------------------------------------

def build_web_search_tool() -> DuckDuckGoSearchRun:
    return DuckDuckGoSearchRun(
        name="web_search",
        description=(
            "Busca na internet por informações SAP atuais, SAP Notes, patches ou novidades. "
            "Use apenas quando o rag_search for insuficiente ou quando o usuário pedir explicitamente."
        ),
    )
