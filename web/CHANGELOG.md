# Changelog — Frontend

Todas as mudanças relevantes do frontend são documentadas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)

---

## [não lançado] — 2026-03-31 (reasoning/thinking display)

### Adicionado
- `src/lib/types.ts`: campo `thinkingElapsedMs?: number` em `ChatMessage`
- `src/hooks/use-chat.ts`: rastreia início/fim do thinking durante stream e salva duração em ms na mensagem
- `src/components/chat/thinking-panel.tsx`: redesenhado — mostra "Pensando…" (com ícone pulsante) durante stream e "Pensou por X segundos" após; texto completo do raciocínio sem altura máxima; seção de ações separada

### Alterado
- `src/components/chat/assistant-message.tsx`: passa `thinkingElapsedMs` ao `ThinkingPanel`

---

## [não lançado] — 2026-03-31 (upload múltiplo de skills)

### Adicionado
- `src/pages/skills-page.tsx`: upload de múltiplas skills ao mesmo tempo via seleção ou drag-and-drop; progresso exibido como "Enviando X de Y…"; arquivos inválidos e erros são reportados sem interromper os demais

---

## [não lançado] — 2026-03-31 (persistência de sessões cross-browser)

### Corrigido
- `src/pages/home-page.tsx`: ao criar nova sessão, chama `upsertSession` para persistir no banco — sessões criadas agora aparecem em outros navegadores
- `src/hooks/use-sessions.ts`: ao montar com DB vazio, sincroniza todas as sessões do localStorage para o banco (migração única) — sessões anteriores passam a ser visíveis cross-browser

---

## [não lançado] — 2026-03-31 (sticky copy button, ZIP download, PDF direto)

### Adicionado
- `src/components/chat/assistant-message.tsx`: botão "Copiar" agora usa wrapper `sticky top-2 h-0 overflow-visible` — permanece visível no topo do bloco ao rolar a página em códigos longos
- `src/lib/types.ts`: interface `OutputFileMeta`
- `src/lib/api.ts`: `getOutputFiles()` e `downloadOutputZip()` — integração com novos endpoints de saída
- `src/hooks/use-chat.ts`: estado `hasOutputFiles`; detecta `write_output_file` no stream e ao carregar histórico
- `src/pages/chat-page.tsx`: botão "Download ZIP" aparece no header quando `hasOutputFiles === true`

### Alterado
- `src/lib/download.ts`: `downloadAsPdf()` reescrita com `jsPDF + html2canvas` (imports dinâmicos) — download direto sem popup de impressão
- `web/package.json`: + `jspdf`, `html2canvas`

---

## [não lançado] — 2026-03-31 (sessions persistence cross-browser)

### Adicionado
- `src/lib/types.ts`: interface `SessionMeta` (espelho do modelo backend)
- `src/lib/api.ts`: `listSessions()`, `upsertSession()`, `patchSession()` — chamadas para os novos endpoints de sessão
- `src/lib/sessions.ts`: `syncSessionsFromBackend()` — converte `SessionMeta[]` do backend para `Session[]` e sobrescreve o cache localStorage

### Alterado
- `src/hooks/use-sessions.ts`: ao montar, sincroniza com backend via `listSessions()` (localStorage permanece como cache imediato); `addSession()` chama `upsertSession()`; `renameSession()` e `togglePin()` chamam `patchSession()` para persistir no banco

---

## [não lançado] — 2026-03-31 (simplificação da página de analytics)

### Removido
- `src/pages/analytics-page.tsx`: cards de "Gasto total" e "Total de tokens" (dependiam de dados LiteLLM)
- `src/pages/analytics-page.tsx`: seção "Budget por provider" com `BudgetCard` (chamava endpoint removido)
- `src/lib/api.ts`: funções `getMetricsSummary()` (agora retorna `null` em caso de erro) e `getMetricsBudget()` removida
- `src/lib/types.ts`: interfaces `MetricsSummary` (campos LiteLLM) e `ProviderBudget` removidas

### Alterado
- `src/pages/analytics-page.tsx`: página reescrita para mostrar apenas dados locais — 3 cards (chamadas, latência média, erros) + gráfico de barras diário + tabela de erros; design clean mantido
- `src/lib/types.ts`: `MetricsSummary` simplificada para `{ total_calls, avg_latency_ms, error_count }` (sem `total_spend` e `total_tokens`)

---

## [não lançado] — 2026-03-31 (sem mudanças de frontend para compressão de imagens)

Otimizações de compressão aplicadas apenas no backend (`image_processor.py` e `pdf_processor.py`). Sem impacto em interfaces ou comportamento visível ao usuário.

---

## [não lançado] — 2026-03-31 (rename/pin de chats, limite de contexto, arquivos Office)

### Adicionado
- `src/lib/sessions.ts`: campos `customTitle?: string` e `pinned?: boolean` em `Session`; funções `renameSession(id, customTitle)` e `togglePin(id)` que persistem no localStorage
- `src/hooks/use-sessions.ts`: `renameSession` e `togglePin` expostos pelo hook; lista de sessões ordenada com pinadas primeiro
- `src/pages/chats-page.tsx`: botão Pin/PinOff (lucide) por chat para fixar/desafixar; modo de rename inline (lápis → input → confirma com Enter ou blur); exibe `customTitle ?? title`
- `src/pages/chat-page.tsx`: header exibe `customTitle ?? title`; botão lápis ao lado do título abre input de rename inline

### Alterado
- `src/hooks/use-chat.ts`: constante `MAX_MESSAGES = 100`; `isBlocked` derivado contando mensagens `role === 'human'`; handler SSE mapeia `CONTEXT_LIMIT_REACHED` para estado de bloqueio
- `src/components/chat/chat-input.tsx`: quando `isBlocked`, renderiza banner "Este chat atingiu o limite máximo de contexto" com link "Criar novo chat →" navegando para `/`; input e botão de envio desabilitados
- `src/components/chat/chat-input.tsx` e `src/components/home/home-input.tsx`: atributo `accept` expandido com `.docx,.xlsx,.xls,.csv`; validação `addFile` aceita Office (≤ 10 MB); label do menu atualizado para "Anexar arquivo (texto, código, PDF, imagem, ZIP, Office)"

---

## [não lançado] — 2026-03-31 (badges de anexos corretas no histórico)

### Corrigido
- `web/src/components/chat/user-message.tsx`: badges de anexos agora exibem ícone e cor distintos por tipo — Archive (amber) para `.zip`, FileType2 (vermelho) para PDF, Image (verde) para imagem, FileText para texto
- `web/src/lib/types.ts`: adicionado `'zip'` ao union `file_type` de `AttachmentMeta`

---

## [não lançado] — 2026-03-31 (suporte a anexos PDF e imagem)

### Adicionado
- `src/lib/types.ts`: tipos `PdfUploadResponse` e `ImageUploadResponse`; campos `file_type` e `mime_type` adicionados a `AttachmentMeta`
- `src/lib/api.ts`: funções `uploadPdfAttachment()` e `uploadImageAttachment()`
- `src/components/chat/chat-input.tsx`: ícones `FileType` (PDF, vermelho) e `Image` (imagem, verde) nos badges de arquivos pendentes
- `src/components/home/home-input.tsx`: idem

### Alterado
- `src/hooks/use-chat.ts`: `sendMessage` detecta `.pdf` e `.jpg/.jpeg/.png/.webp` e chama os endpoints corretos antes de enviar a mensagem
- `src/components/chat/chat-input.tsx`: `addFile` aceita PDF (≤ 10 MB) e imagens (≤ 5 MB); `accept` do input expandido; label do menu atualizado; placeholder de drag-and-drop simplificado
- `src/components/home/home-input.tsx`: mesmas alterações do `chat-input`

---

## [não lançado] — 2026-03-30 (correção de scroll durante streaming)

### Adicionado
- `src/components/chat/message-list.tsx`: botão "Retomar scroll automático" / "Ir para o final" — aparece quando o usuário rola para cima; clique resume o auto-scroll
- `src/components/chat/message-list.tsx`: prop `isStreaming` — altera o label do botão de scroll conforme o estado de geração

### Corrigido
- `src/components/chat/message-list.tsx`: substituído `scrollIntoView({ behavior: 'smooth' })` por `el.scrollTop = el.scrollHeight` no auto-scroll — eliminado jank durante streaming de alta frequência
- `src/components/chat/message-list.tsx`: scroll automático não mais interfere quando o usuário rola manualmente (detectado via `isNearBottom()` com tolerância de 120px)
- `src/pages/chat-page.tsx`: prop `isStreaming` passada para `<MessageList>` para exibir label correto no botão de scroll

---

## [não lançado] — 2026-03-30 (copy por bloco de código e mais extensões de attachment)

### Adicionado
- `src/components/chat/assistant-message.tsx`: botão de copiar por bloco de código — aparece no hover (`group-hover/code:opacity-100`), posicionado absolutamente no canto superior direito do bloco; reutiliza o `CopyButton` existente com prop `className` opcional

### Alterado
- `src/components/chat/chat-input.tsx`: arquivo `accept` expandido para incluir `.md`, `.cds`, `.py`, `.js`, `.ts`, `.tsx`, `.jsx`, `.json`, `.xml`, `.yaml`, `.yml`, `.sql` além de `.txt` e `.zip`; validação `addFile` atualizada para verificar lista de extensões de texto
- `src/components/chat/assistant-message.tsx`: `CopyButton` aceita prop `className` opcional para uso em contextos com posicionamento diferente

---

## [não lançado] — 2026-03-30 (loading skeletons em todas as telas)

### Adicionado
- `src/pages/chats-page.tsx`: skeleton de grupos e linhas de conversa no carregamento inicial
- `src/pages/skills-page.tsx`: skeleton de cards de skill enquanto `getSkills()` resolve; estado `loading` adicionado ao componente
- `src/pages/analytics-page.tsx`: skeleton nos 4 cards de resumo, no gráfico de barras e na tabela de erros; `SummaryCard` aceita prop `loading` para renderizar skeleton internamente
- `src/components/ui/skeleton.tsx`: componente shadcn adicionado via `npx shadcn add skeleton`

---

## [não lançado] — 2026-03-30 (confirmações de deleção e multi-select de chats)

### Adicionado
- `src/pages/chats-page.tsx`: checkboxes por sessão para seleção múltipla; barra de ação em lote aparece ao selecionar (mostra contagem + botão "Remover selecionadas"); seleção é limpa ao alterar filtro de busca
- `src/pages/chats-page.tsx`: AlertDialog de confirmação antes de deletar sessão(ões) — exibe aviso de irreversibilidade e quantidade afetada
- `src/pages/skills-page.tsx`: AlertDialog de confirmação antes de deletar skill
- `src/hooks/use-sessions.ts`: método `deleteSessions(ids[])` para deleção em lote via `deleteSessionsBulk()`
- `src/lib/api.ts`: função `deleteSessionsBulk(ids[])` → `POST /chat/sessions/bulk-delete`
- `src/components/ui/alert-dialog.tsx` e `checkbox.tsx`: componentes shadcn adicionados

---

## [não lançado] — 2026-03-30 (analytics com integração LiteLLM)

### Alterado
- `src/pages/analytics-page.tsx`: removidos line chart e bar chart de tokens (dados sempre 0); substituídos por bar chart de chamadas/dia e seção de budget por provider; cards mostram gasto ($) e tokens do LiteLLM (exibe "N/D" se proxy indisponível)
- `src/lib/types.ts`: removida `DailyUsage`; adicionadas `DailyCalls` e `ProviderBudget`; `MetricsSummary` atualizada para incluir `total_spend` e `total_tokens` (de LiteLLM)
- `src/lib/api.ts`: removida `getMetricsUsage()`; adicionadas `getMetricsCalls()` e `getMetricsBudget()`

---

## [não lançado] — 2026-03-30 (analytics de tokens e erros)

### Adicionado
- `src/pages/analytics-page.tsx`: nova página `/analytics` com seletor de período (Hoje/7/30/Tudo), 4 cards de resumo (total tokens, chamadas, média e erros), line chart de tokens por dia, bar chart empilhado de entrada vs saída e tabela de erros recentes
- `src/lib/types.ts`: interfaces `DailyUsage`, `MetricsSummary` e `ErrorLog`
- `src/lib/api.ts`: funções `getMetricsUsage()`, `getMetricsSummary()` e `getMetricsErrors()`
- `src/components/layout/nav-sidebar.tsx`: item "Analytics" com ícone `BarChart2` no menu lateral
- `src/app.tsx`: rota `/analytics` adicionada ao roteador

### Alterado
- `package.json`: dependência `recharts` adicionada para os componentes de gráfico
- `src/components/ui/chart.tsx`: componente `ChartContainer` do shadcn/ui adicionado via `npx shadcn add chart`

---

## [não lançado] — 2026-03-30 (suporte a arquivos ZIP como attachments)

### Adicionado
- `src/lib/types.ts`: interface `ZipUploadResponse` e campos `source_zip`/`zip_path` em `AttachmentMeta`
- `src/lib/api.ts`: função `uploadZipAttachment()` para enviar arquivos ZIP ao endpoint backend
- `src/components/chat/chat-input.tsx` e `src/components/home/home-input.tsx`: suporte a upload de arquivos ZIP (.zip até 50MB)
- `src/components/chat/chat-input.tsx` e `src/components/home/home-input.tsx`: ícone `Archive` para distinguir visualmente badges de ZIP dos badges de TXT

### Alterado
- `src/hooks/use-chat.ts`: lógica de upload expandida para detectar arquivos ZIP e usar endpoint específico
- `src/hooks/use-chat.ts`: badges de ZIP mostram emoji 📦, nome do arquivo e contador de arquivos extraídos
- `src/components/chat/chat-input.tsx` e `src/components/home/home-input.tsx`: atributo `accept` atualizado para `.txt,.zip`
- `src/components/chat/chat-input.tsx` e `src/components/home/home-input.tsx`: placeholders atualizados para mencionar suporte a ZIP
- `src/components/chat/chat-input.tsx` e `src/components/home/home-input.tsx`: validação de tamanho expandida com limites específicos (500KB para TXT, 50MB para ZIP)

---

## [não lançado] — 2026-03-27 (submenu de habilidades)

### Alterado
- `chat-input.tsx` e `home-input.tsx`: skills movidas para `DropdownMenuSub` — ao invés de listar checkboxes diretamente no dropdown (que crescia indefinidamente), agora "Habilidades" abre um submenu lateral com scroll (`max-h-64`), título + descrição por skill, badge com contagem de selecionadas, e link "Gerenciar habilidades" → `/skills`

---

## [não lançado] — 2026-03-27 (reverter balanceCodeFences)

### Corrigido
- `assistant-message.tsx`: revertida `balanceCodeFences` que adicionava ``` extra ao fim do conteúdo — a abordagem de contar fences não resolvia o problema (heading dentro do bloco) e criava novos artefatos visuais

---

## [não lançado] — 2026-03-27 (retry de fase após erro)

### Corrigido
- `hooks/use-chat.ts`: `retryLast` agora passa `skillNames` (via `lastSkillNamesRef`) ao reenviar — antes, clicar "Tentar novamente" após uma fase com erro enviava o texto sem a instrução de skill, fazendo o agente não executar a fase correta
- `hooks/use-chat.ts`: evento `error` do SSE agora extrai `chunk.next_skill` e salva em `nextSkill` na mensagem — se o backend indicar qual skill falhou, o chip de sugestão aparece mesmo após erro
- `components/chat/assistant-message.tsx`: chip de sugestão de próxima etapa agora aparece também quando `hasError = true` — permite ao usuário clicar para repetir a fase que falhou (ex: timeout na geração de resposta longa)

---

## [não lançado] — 2026-03-27

### Adicionado
- `components/chat/chat-input.tsx` e `components/home/home-input.tsx`: seção "Habilidades" no menu de opções (`+`) com `DropdownMenuCheckboxItem` por skill ativa — permite selecionar/desselecionar skills diretamente do menu sem usar o slash command; menu permanece aberto ao clicar (`onSelect: e.preventDefault()`)
- Pensamento e Pesquisa na web migrados para `DropdownMenuCheckboxItem` no mesmo menu — exibem estado atual (marcado/desmarcado) sem fechar o dropdown
- `components/chat/assistant-message.tsx`: chip de sugestão "▶ [Próxima Fase]" abaixo da resposta quando o backend emite `next_skill` — clicar envia automaticamente a próxima etapa sem digitar nada
- `components/chat/assistant-message.tsx`: botão "Baixar análise completa" (ícone de livro) na última fase de uma cadeia — concatena o conteúdo de todas as fases anteriores para download combinado em Markdown ou PDF
- `hooks/use-chat.ts`: `sendNextStep(skillName, webSearchEnabled)` — dispara a próxima etapa de análise mantendo a preferência de web search
- `pages/chat-page.tsx`: `onSendNextStep` conectado ao `MessageList` passando `webSearchEnabled` atual

### Corrigido
- `hooks/use-chat.ts`: ao carregar histórico, cada tool call agora usa o nome real da ferramenta (`msg.tool_name`) em vez de `'rag_search'` fixo — corrige o ThinkingPanel que exibia "Base de conhecimento SAP" para todas as ações (inclusive `use_skill`, `web_search`, etc.) ao retornar a um chat salvo
- `lib/types.ts`: campo `tool_name?: string | null` adicionado a `HistoryMessage` para receber o nome da ferramenta retornado pelo backend
- `components/chat/assistant-message.tsx`: blocos de código sem especificador de linguagem (` ``` ` sem tag) agora renderizam como bloco via `SyntaxHighlighter` com `language='text'` em vez de inline `<code>` — corrige exibição de matrizes ASCII e outros blocos gerados por skills que não declaram linguagem

---

## [não lançado] — 2026-03-27 (TODO tasks 1-4)

### Adicionado
- `hooks/use-chat.ts`: constante de módulo `DOC_INTENT_RE` — ao carregar histórico, mensagens do assistente recebem `isDocument: true` se a mensagem humana anterior contém keywords de documentação (persistência do botão PDF após reload)

### Alterado
- `hooks/use-chat.ts`: `loadHistory` agora extrai o texto original da mensagem humana a partir de `'Pergunta do usuário: '` independentemente do prefixo — corrige exibição de instruções injetadas (skills, web search, etc.) no histórico
- `hooks/use-chat.ts`: `sendMessage` aceita `skillNames?: string[]` em vez de `skillName?: string`
- `lib/api.ts`: `streamMessage` envia `skill_names: string[]` em vez de `skill_name`; novo parâmetro `skillNames?: string[]`
- `components/chat/chat-input.tsx`: `selectedSkill: SkillMeta | null` → `selectedSkills: SkillMeta[]`; múltiplos badges de skill; skill adicional via `/` sem remover as anteriores; `onSend` recebe `skillNames?: string[]`
- `components/home/home-input.tsx`: mesmas mudanças de múltiplas skills; `onSubmit` recebe `skillNames?: string[]`
- `pages/chat-page.tsx` e `pages/home-page.tsx`: atualizados para passar `skillNames` no estado de navegação e no callback `onSend`
- `hooks/use-chat.ts`: handler do evento `done` define `isDocument: true` quando `chunk.is_document` é verdadeiro
- `lib/download.ts` e `components/chat/assistant-message.tsx`: botão PDF aparece para respostas com intent de documentação (skill acionada ou keywords detectadas), não apenas quando skill é explicitamente invocada

## [não lançado] — 2026-03-27 (download PDF e Markdown)

### Adicionado
- `lib/download.ts`: utilitários `downloadAsMarkdown()` e `downloadAsPdf()` — converte conteúdo markdown para `.md` (Blob download) ou PDF (nova janela + `window.print()` via `marked`)
- `components/chat/assistant-message.tsx`: botão `DownloadMenu` no footer de cada mensagem do assistente — ícone `Download` abre dropdown com opções "Markdown (.md)" e "PDF"; visível apenas após o streaming terminar e sem erros
- Dependência `marked` (v17) para conversão markdown → HTML na geração de PDF

---

## [não lançado] — 2026-03-27 (badges + web search + fix texto longo)

### Adicionado
- `lib/prefs.ts`: `getWebSearchEnabled` / `setWebSearchEnabled` (chave `atem_web_search`, padrão `true`)
- Badges de "Pensamento" (Brain) e "Pesquisa na web" (Globe) acima do input — aparecem quando a feature está ativa; botão X desativa e remove o badge
- Opção "Ativar pensamento" e "Ativar pesquisa na web" no menu Opções — só aparecem quando a respectiva feature está desativada
- `pages/chat-page.tsx` e `home-page.tsx`: estado `webSearchEnabled` persistido em localStorage; `toggleWebSearch` passado para os inputs

### Alterado
- `components/chat/chat-input.tsx`: `onSend` agora aceita `webSearchEnabled?: boolean`; `handleInput` controla banner de texto longo bidirecionalmente (aparece ao colar, some ao apagar); `submit()` verifica threshold antes de enviar (cobre clique no botão Enviar); "Enviar assim mesmo" no banner usa `submit(undefined, true)` para forçar envio
- `components/home/home-input.tsx`: mesmas correções + banner de texto longo adicionado (não existia antes); `onSubmit` aceita `webSearchEnabled?: boolean`
- `lib/api.ts`: `streamMessage` inclui `web_search_enabled` no body da requisição
- `hooks/use-chat.ts`: `sendMessage` aceita `webSearchEnabled?: boolean` e repassa para `streamMessage`

### Corrigido
- Banner "Mensagem longa" não aparecia ao colar texto (paste) nem ao clicar no botão Enviar — corrigido em `handleInput` (reativo) e `submit()` (guarda)

---

## [não lançado] — 2026-03-27 (opções no input)

### Alterado
- `components/chat/chat-input.tsx`: substituído botão `Paperclip` avulso por botão `SlidersHorizontal` (Opções) com menu dropdown acima do input; menu contém "Anexar arquivo (.txt)" e "Pensamento do agente ON/OFF"; aceita novas props `thinkingEnabled` e `onThinkingToggle`
- `components/home/home-input.tsx`: mesmas mudanças do `ChatInput`; opções no action bar inferior do card
- `pages/chat-page.tsx`: removido botão `Brain` do header; `thinkingEnabled` e `onThinkingToggle` passados para `ChatInput`
- `pages/home-page.tsx`: removido botão `Brain` do greeting; props passadas para `HomeInput`; simplificado div do greeting (sem `relative`)

---

## [não lançado] — 2026-03-27

### Adicionado
- `lib/prefs.ts`: módulo de preferências em localStorage (`atem_thinking_panel`) com `getThinkingEnabled` / `setThinkingEnabled`
- Toggle de pensamento (ícone `Brain`) no header da tela de chat e no canto da tela inicial — persiste entre sessões via localStorage

### Alterado
- `lib/types.ts`: `ToolCall` enriquecido com `toolInput?: Record<string, string>` (parâmetros de entrada) e `sourceDocs?: Array<{filename}>` (documentos RAG consultados)
- `hooks/use-chat.ts`: ao receber `tool_start`, tenta parsear `chunk.content` como JSON → `toolInput`; ao receber `tool_end` de `rag_search`, extrai `<!--SOURCES_META:...-->` do output → `sourceDocs`
- `components/chat/tool-badge.tsx`: redesenhado com detalhe do input por tipo de tool (query em itálico para rag/web, URL para scrape_url, `/skill_name` para use_skill); `rag_search` exibe badges dos documentos consultados; `web_search` exibe snippet colapsável do resultado
- `components/chat/thinking-panel.tsx`: redesenhado com duas seções visuais distintas — "Pensamento" (thinking tokens em itálico) e "Ações" (tool calls enriquecidos); trigger exibe resumo dinâmico (ex: "pensamento · 2 ações")
- `components/chat/assistant-message.tsx`: aceita prop `thinkingEnabled` e repassa para `ThinkingPanel`
- `components/chat/message-list.tsx`: aceita e repassa prop `thinkingEnabled` para `AssistantMessage`
- `pages/chat-page.tsx`: lê preferência de thinking no mount; exibe toggle `Brain` no header
- `pages/home-page.tsx`: exibe toggle `Brain` no canto do greeting; sincroniza com mesma preferência

---

## [não lançado] — 2026-03-26

### Adicionado
- Sistema de Skills: página `/skills` com upload drag & drop de `.md`/`.txt`, lista de skills com toggle ativo/inativo e delete
- Slash command `/nome-da-skill` em `ChatInput` e `HomeInput`: popover filtrável acima do textarea, Tab para autocompletar, skill selecionada vira badge removível
- `SkillMeta` em `lib/types.ts`; funções `getSkills`, `uploadSkill`, `deleteSkill`, `toggleSkill` em `lib/api.ts`
- Rota `/skills` em `app.tsx`; item "Skills" com ícone `Zap` na `nav-sidebar.tsx`
- Suporte a `skillName` em `use-chat.ts` → `sendMessage(text, files?, skillName?)` → passado no body do POST
- Badge `use_skill` no `tool-badge.tsx` com ícone Zap e label "Aplicando skill especializada"
- Badge `scrape_url` no `tool-badge.tsx`

### Alterado
- `AssistantMessage`: `<SourcesPanel>` movido para **abaixo** do conteúdo (era acima)
- `UserMessage`: badges de anexos movidos para **abaixo** da bolha de mensagem
- `ChatInput`: prop `onSend` alterada para `(text, skillName?) => void`; adicionado suporte a skill picker
- `HomeInput`: adicionado suporte a skill picker (mesma lógica do `ChatInput`)
- `chat-page.tsx`: carrega skills via `getSkills()` e passa para `ChatInput`; lê `skillName` do navigation state
- `home-page.tsx`: carrega skills via `getSkills()` e passa para `HomeInput`; repassa `skillName` no navigate state
- `use-chat.ts` / `loadHistory()`: strip do prefixo `[Contexto de arquivos...]` injetado pelo backend; session files atribuídos à primeira mensagem humana com prefixo

### Corrigido
- Histórico exibindo conteúdo de arquivos TXT como texto da mensagem do usuário
- Skill picker fechando antes de registrar o clique (corrigido com `onMouseDown + e.preventDefault()`)
