# Agent Chat com RAG — Plano de Implementação

## Contexto

O projeto já possui um pipeline RAG completo (ingestão de PDFs SAP, chunking, embeddings, busca híbrida pgvector + FTS + trigrama, RRF). Falta a camada de IA: um agente conversacional com memória de sessão persistida no PostgreSQL, busca na web, e entrega de respostas em streaming via FastAPI.

O agente é **agnóstico ao provider de LLM**, configurado via variáveis de ambiente. A infra usa um proxy LiteLLM (OpenAI-compatible), permitindo usar qualquer modelo (Gemini, Claude, OpenAI, local) sem trocar código.

**Variáveis de ambiente do LLM:**
```
LLM_MODEL=gemini/gemini-2.5-flash
LLM_API_KEY=sk-...
LLM_BASE_URL=http://100.80.163.147:4000
LLM_MAX_TOKENS=256000
LLM_TEMPERATURE=0.3
CONTEXT_WINDOW=1000000
```

**Status:** ✅ Implementado

---

## Epic 1 — Dependências e Configuração ✅

### Task 1.1 — Pacotes adicionados ao `pyproject.toml`
- `langgraph>=0.2.0`
- `langchain-openai>=0.1.0`
- `langchain-community>=0.2.0`
- `langgraph-checkpoint-postgres>=2.0.0`
- `psycopg[binary]>=3.1.1`
- `duckduckgo-search>=6.0.0`

### Task 1.2 — `app/config.py` estendido
Campos LLM: `llm_model`, `llm_api_key`, `llm_base_url`, `llm_max_tokens`, `llm_temperature`, `context_window`.
Property `postgres_dsn` para URL psycopg3-compatible (usada pelo `AsyncPostgresSaver`).

### Task 1.3 — `.env.example` atualizado
Exemplos para OpenAI direto e LiteLLM proxy.

---

## Epic 2 — Infraestrutura do Agente ✅

| Arquivo | Responsabilidade |
|---|---|
| `app/agent/context_var.py` | `ContextVar[AsyncSession]` para injetar DB nas tools |
| `app/agent/prompts.py` | System prompt PT-BR para assistente SAP |
| `app/agent/memory.py` | Singleton `AsyncPostgresSaver` com `setup()` automático |
| `app/agent/tools.py` | `rag_search` (wraps `build_context`) + `web_search` (DuckDuckGo) |
| `app/agent/agent.py` | Singleton `create_react_agent` com LLM agnóstico via `ChatOpenAI(base_url=...)` |

**Padrão ContextVar:** LangGraph chama tools via `await` no mesmo Task asyncio do request. Definindo `db_session_var` antes de invocar o agente, as tools herdam a sessão sem injeção explícita.

**LLM agnóstico:** `ChatOpenAI` com `base_url=LLM_BASE_URL` redireciona para o proxy LiteLLM, que suporta Gemini, Claude, OpenAI, modelos locais etc.

---

## Epic 3 — Modelos Pydantic ✅

`app/models/chat.py`:
- `CreateSessionResponse` — resposta de criação de sessão
- `MessageRequest` — corpo da mensagem
- `MessageChunk` — unidade SSE (`type`: token/tool_start/tool_end/error/done)
- `HistoryMessage` — mensagem no histórico
- `HistoryResponse` — lista de mensagens da sessão

---

## Epic 4 — Rotas de Chat ✅

`app/routers/chat.py`:

| Rota | Método | Descrição |
|---|---|---|
| `/chat/sessions` | POST | Cria sessão (UUID v4) |
| `/chat/{session_id}/message` | POST | Envia mensagem, stream SSE |
| `/chat/{session_id}/history` | GET | Retorna histórico persistido |
| `/chat/{session_id}` | DELETE | Encerra sessão (204) |

**Streaming:** `StreamingResponse` + `agent.astream_events(version="v2")` → SSE.

---

## Epic 5 — Integração no `app/main.py` ✅

- Router `/chat` registrado
- Lifespan async com pre-warm do agente no startup

---

## Verificação End-to-End

```bash
# 1. Banco e API
docker compose up -d && pdm install && pdm run dev

# 2. Criar sessão
curl -X POST http://localhost:8000/chat/sessions

# 3. Mensagem com streaming
curl -N -X POST http://localhost:8000/chat/{session_id}/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Como lançar uma nota fiscal no módulo FI?"}'

# 4. Histórico
curl http://localhost:8000/chat/{session_id}/history

# 5. Follow-up (testa memória)
curl -N -X POST http://localhost:8000/chat/{session_id}/message \
  -H "Content-Type: application/json" \
  -d '{"message": "E quais tabelas SAP são usadas nesse processo?"}'
```
