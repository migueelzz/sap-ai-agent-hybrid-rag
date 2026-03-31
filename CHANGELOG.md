# Changelog — Backend

Todas as mudanças relevantes do backend são documentadas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)

---

## [não lançado] — 2026-03-30 (código completo obrigatório e mais extensões de attachment)

### Alterado
- `app/agent/prompts.py`: adicionada regra absoluta de código completo — proíbe qualquer placeholder como `# Aqui vai sua lógica`, `// TODO`, `pass # implementar` etc.; todo bloco de código deve ser funcional e executável
- `app/routers/chat.py`: endpoint `upload_attachment` agora aceita todas as extensões do `ALLOWED_EXTENSIONS` (`.txt`, `.md`, `.cds`, `.py`, `.js`, `.ts`, `.tsx`, `.jsx`, `.json`, `.xml`, `.yaml`, `.yml`, `.sql`) em vez de apenas `.txt`

---

## [não lançado] — 2026-03-30 (suporte a Google Gemini direto via .env)

### Adicionado
- `app/config.py`: campo `LLM_PROVIDER` — aceita `"google"` para usar a API do Google diretamente (endpoint OpenAI-compatible), ou vazio para manter comportamento via `LLM_BASE_URL`
- `app/agent/agent.py`: função `_resolve_llm()` que detecta o provider e configura `base_url` e model name automaticamente; `LLM_PROVIDER=google` injeta `https://generativelanguage.googleapis.com/v1beta/openai/` e remove o prefixo `gemini/` do model name (formato LiteLLM)
- `.env.example`: campo `LLM_PROVIDER` com três exemplos comentados (Google, LiteLLM, OpenAI)

---

## [não lançado] — 2026-03-30 (limpeza real ao deletar sessões)

### Alterado
- `app/routers/chat.py`: `DELETE /{session_id}` agora executa limpeza completa no banco — remove `session_files`, `chat_usage`, `chat_errors` e dados do checkpointer LangGraph (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`) para o `thread_id` correspondente
- `app/routers/chat.py`: adicionado endpoint `POST /sessions/bulk-delete` que aceita lista de `session_ids` e realiza limpeza em lote com `ANY(:ids)`

---

## [não lançado] — 2026-03-30 (analytics de tokens e otimização de build Docker)

### Adicionado
- `scripts/migration_add_metrics.sql`: migração idempotente com tabelas `chat_usage` e `chat_errors` para rastreamento de consumo e erros
- `scripts/00_schema.sql`: tabelas `chat_usage` e `chat_errors` incluídas no schema inicial para novas instalações
- `app/models/metrics.py`: modelos Pydantic `DailyUsage`, `MetricsSummary` e `ErrorLog`
- `app/routers/metrics.py`: router `/metrics` com endpoints `GET /usage`, `GET /summary` e `GET /errors`
- `app/routers/chat.py`: função `_extract_tokens()` para normalizar campos de uso entre OpenAI, Anthropic e Gemini/LiteLLM
- `app/routers/chat.py`: persistência de tokens (`chat_usage`) e erros (`chat_errors`) ao final de cada chamada ao agente

### Alterado
- `Dockerfile`: substituído `pip install pdm && pdm export && pip install` por `uv` (10-100× mais rápido); PyTorch CPU-only (~300MB vs ~2GB CUDA); BuildKit cache mounts; modelo `paraphrase-MiniLM-L6-v2` pré-baixado durante o build — tempo de build ~30min → ~10min
- `app/main.py`: router de métricas registrado em `/metrics`

---

## [não lançado] — 2026-03-30 (suporte a arquivos ZIP como attachments)

### Adicionado
- `scripts/migration_zip_support.sql`: migração de schema para adicionar colunas `source_zip` e `zip_path` à tabela `session_files`
- `app/routers/chat.py`: endpoint `POST /chat/{session_id}/zip-attachment` para upload e processamento seguro de arquivos ZIP
- `app/routers/chat.py`: validações de segurança para ZIP (tamanho máx 50MB, máx 100 arquivos, proteção zip bomb, directory traversal)
- `app/routers/chat.py`: função `_extract_zip_safely()` com extração controlada e validação de extensões permitidas (.txt, .md, .cds, .py, .js, .ts, .tsx, .jsx, .json, .xml, .yaml, .yml, .sql)
- `app/agent/tools.py`: ferramenta `zip_file_explorer` para o agente navegar estrutura de arquivos extraídos do ZIP
- `app/agent/agent.py`: inclusão da ferramenta `zip_file_explorer` nas tools disponíveis do agente

### Alterado
- `app/routers/chat.py`: função `_load_session_files()` agora agrupa e organiza arquivos por ZIP de origem, mantendo hierarquia clara no contexto
- `app/routers/chat.py`: constantes de validação expandidas para suportar múltiplos tipos de arquivo e limites específicos por formato

---

## [não lançado] — 2026-03-27 (corrigir headings dentro de blocos de código)

### Adicionado
- `app/routers/chat.py`: função `_fix_code_block_headings()` — rastreia estado de bloco ` ``` ` ao longo do stream e injeta fence de fechamento quando detecta um heading (`##` ou mais) dentro de um bloco aberto; corrige bug onde o LLM omite o ` ``` ` antes de uma nova seção

### Alterado
- `app/routers/chat.py`: `_stream_agent()` agora mantém variável `_in_code_block` entre tokens e aplica `_fix_code_block_headings` em cada token de texto

---

## [não lançado] — 2026-03-27 (preservar newlines no stream)

### Corrigido
- `app/routers/chat.py`: filtro de tokens whitespace-only agora preserva tokens que contêm `\n` — antes, newlines isolados eram descartados, quebrando blocos de código e headings (ex: ```` ``` ```` de fechamento ficava sem quebra de linha, fazendo conteúdo subsequente ser renderizado dentro do bloco)

---

## [não lançado] — 2026-03-27 (detecção proativa de resposta truncada)

### Corrigido
- `app/routers/chat.py`: detecta `finish_reason="length"` / `stop_reason="max_tokens"` no evento `on_chat_model_end` e lança `RuntimeError` com mensagem amigável antes que o erro JSON interno do LangChain ocorra — mantém compatibilidade com OpenAI, Anthropic e proxies LiteLLM

### Alterado
- `app/routers/chat.py`: instrução de fases de cadeia (`_CHAIN_PHASES`) agora inclui diretiva de concisão para reduzir chance de truncação por `max_tokens`

---

## [não lançado] — 2026-03-27 (retry de fase após erro)

### Corrigido
- `app/routers/chat.py`: evento `error` agora inclui campo `next_skill` apontando para a skill que estava sendo processada quando o erro ocorreu — permite ao frontend exibir chip de retry da mesma fase após timeout ou `JSONDecodeError`

---

## [não lançado] — 2026-03-27 (skill chains passo a passo)

### Adicionado
- `app/routers/chat.py`: `_SKILL_CHAINS` — mapa de orquestradores para fases (`cds-doc-analysis` → 4 fases); `_next_in_chain()` retorna a próxima skill da cadeia
- `app/routers/chat.py`: campo `next_skill` no evento `done` do SSE — backend calcula a próxima fase com base no último `use_skill` executado
- `app/models/chat.py`: campo `next_skill: str | None = None` em `MessageChunk`

### Alterado
- `app/routers/chat.py`: instrução de skill única agora diferencia orquestradores, fases e skills avulsas — orquestradores executam apenas a PRIMEIRA fase e param; fases executam apenas si próprias; skills avulsas mantêm comportamento de execução completa em sequência

---

## [não lançado] — 2026-03-27

### Corrigido
- `app/agent/tools.py`: output de `use_skill` truncado em 6000 caracteres para preservar instruções completas das skills sem desperdiçar contexto desnecessariamente
- `app/agent/agent.py`: `pre_model_hook=_compress_skill_history` comprime skills já processadas para os primeiros 600 chars (preserva instruções de fluxo/orquestração) em vez de apenas o título; colapsa espaços excessivos de padding; parâmetro corrigido de `messages_modifier` para `pre_model_hook` (API LangGraph atual)
- `app/routers/chat.py`: instrução de skill única enriquecida — quando a skill define um fluxo de múltiplas fases, o agente recebe instrução explícita de executar TODAS as fases em sequência sem parar entre elas
- `app/routers/chat.py`: erro `Expecting value: line 1 column 1 (char 0)` (JSONDecodeError quando o LLM esgota `max_tokens` ao gerar tool call) agora retorna mensagem legível pedindo para dividir a análise em etapas; recomendação: aumentar `LLM_MAX_TOKENS` para 8192+ no `.env` para cadeias de análise completa
- `app/routers/chat.py` + `app/models/chat.py`: `HistoryMessage` agora inclui campo `tool_name` extraído de `ToolMessage.name`, corrigindo a serialização do histórico que antes descartava o nome da ferramenta usada

---

## [não lançado] — 2026-03-27 (TODO tasks 1-4)

### Adicionado
- `app/limiter.py`: módulo centralizado com `slowapi.Limiter` (key: IP remoto)
- `app/main.py`: integração do rate limiter + handler HTTP 429
- Rate limits por IP: `/chat/{id}/message` 20/min, `/chat/{id}/extract-document` 10/min, `POST /sessions` 20/min, `/chat/{id}/attachments` 30/min
- `app/models/chat.py`: campo `is_document: bool = False` em `MessageChunk` e novo modelo `ExtractDocumentRequest`
- `app/routers/chat.py`: regex `_DOC_INTENT_RE` para detectar intent de documentação no texto do usuário; `_is_document` inicializado a partir do regex e atualizado quando `use_skill` é invocado; campo `is_document` emitido no evento `done`
- `app/agent/prompts.py`: seção "Raciocínio antes de responder" com instrução de planejamento passo a passo antes de executar ferramentas

### Alterado
- `app/models/chat.py`: `MessageRequest.skill_name: str | None` → `skill_names: list[str] = []` — suporte a múltiplas skills simultâneas
- `app/routers/chat.py`: `_stream_agent` aceita `skill_names: list[str]`; gera instrução OBRIGATÓRIA para execução sequencial de múltiplas skills; endpoint `send_message` repassa `req.skill_names`

## [não lançado] — 2026-03-27

### Adicionado
- `app/models/chat.py`: campo `web_search_enabled: bool = True` em `MessageRequest`
- `app/routers/chat.py`: parâmetro `web_search_enabled` em `_stream_agent()`; quando `False`, injeta instrução `"INSTRUÇÃO: Não utilize a ferramenta web_search nesta resposta. Use apenas o rag_search."` no contexto da mensagem, desabilitando a busca na web sem reinicializar o agente singleton

### Alterado
- `app/routers/chat.py`: evento `on_tool_start` agora serializa os parâmetros de entrada da tool como JSON no campo `content` do `MessageChunk` (ex: `{"query": "SAP FI"}`) para enriquecer o ThinkingPanel no frontend

---

## [não lançado] — 2026-03-26

### Adicionado
- Sistema de Skills: tabela `skills`, router `/skills` com CRUD (upload `.md`/`.txt`, toggle ativo/inativo, delete)
- Tool `use_skill` no agente LangGraph para carregamento lazy de skills por nome
- Injeção de índice compacto de skills (nome + descrição) em cada mensagem quando há skills ativas
- Invocação manual de skill via `skill_name` no `MessageRequest`: backend injeta instrução obrigatória para o agente chamar `use_skill` como primeira ação
- `scripts/migration_skills.sql`: migration idempotente para a tabela `skills`
- `scripts/00_schema.sql`: schema completo renomeado de `schema.sql` para garantir execução antes das migrations no Docker initdb

### Alterado
- `app/agent/tools.py`: `web_search` reescrito como `@tool async def` com tratamento de exceções (evita crash do stream SSE por `ConnectError` do DuckDuckGo)
- `app/agent/prompts.py`: removida seção "DOCUMENTOS DE REFERÊNCIA" da estrutura obrigatória de resposta; adicionada instrução de uso de `use_skill`; regra de separadores de tabela compactos (`| --- |`)
- `app/routers/chat.py`: adicionado `_collapse_table_padding()` para colapsar sequências de 5+ traços em separadores de tabela; adicionado `_load_skills_index()`; contexto de mensagem rebuilt com `ctx_parts`
- `app/models/chat.py`: adicionado `skill_name: str | None = None` ao `MessageRequest`
- `app/main.py`: incluído router de skills com prefix `/skills`

### Corrigido
- Tabelas Markdown com centenas de traços quebrando o parse de JSON no frontend (colapso de `---...---` → `---`)
- `ConnectError` do DuckDuckGo propagando como exceção não tratada e abortando o stream SSE
- Docker Compose executando `migration_*.sql` antes do `schema.sql` (corrigido renomeando para `00_schema.sql`)
