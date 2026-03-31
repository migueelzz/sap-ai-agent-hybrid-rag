---
name: cds-behavior-analysis
description: >
  Skill especializada na análise comportamental de CDS Views ABAP. Executa as etapas 6 a 8
  da análise: filtros e restrições que definem o universo de dados, regras implícitas no
  código (CASE WHEN, COALESCE, casts, flags), e leitura de annotations como pistas de
  processo e consumo. Use esta skill quando o usuário quiser entender POR QUE a CDS
  retorna determinados dados — não apenas O QUE ela retorna. Ative quando o usuário
  perguntar: "por que essa CDS não retorna todos os registros?", "essa view tem algum
  filtro?", "o que esse CASE WHEN faz?", "o que essas annotations significam?",
  "essa CDS serve para Fiori ou para relatório?". Executar após cds-structural-analysis
  em análises completas.
---

# Skill: Análise Comportamental de CDS (Etapas 6–8)

## Responsabilidade

Esta skill responde à pergunta: **"Como essa CDS se comporta e o que controla seus dados?"**

Cobre: filtros que restringem o universo de dados, lógica embutida que gera campos
derivados, e annotations que revelam o destino e o propósito funcional da view.

**Pré-requisito:** o resultado da `cds-structural-analysis` (Etapas 0–5) deve estar
disponível antes de executar esta skill.

---

## ETAPA 6 — Identificação de Filtros e Restrições

Analise: cláusula `where` fixa, parâmetros da CDS, filtros nos joins e conditions
embutidas.

```
MATRIZ DE FILTROS E RESTRIÇÕES
══════════════════════════════════════════════════════════════════════════════════
 Filtro / Restrição         │ Tipo        │ Impacto no Resultado    │ Hipótese Funcional
────────────────────────────┼─────────────┼─────────────────────────┼──────────────────────
 (preencher)                │             │                         │
══════════════════════════════════════════════════════════════════════════════════

TIPOS DE FILTRO:
Idioma | Status | Mandante | Organização | Data/Vigência | Parâmetro | Técnico
```

⚠️ **Leitura correta:** filtros embutidos NÃO são apenas detalhes técnicos.
Eles definem o **universo de dados** que a CDS entrega. Um filtro `status = 'A'`
não é técnico — é uma decisão de negócio que esconde todos os registros inativos.

**Saída:** matriz de filtros com impacto funcional de cada um.

---

## ETAPA 7 — Regras Implícitas no Código

Procure por lógica que não aparece como `where` mas afeta o resultado ou cria
campos derivados:

```
CATÁLOGO DE REGRAS IMPLÍCITAS
══════════════════════════════════════════════════════════════
 Regra                  │ Evidência Técnica         │ Efeito Funcional
────────────────────────┼───────────────────────────┼───────────────────────────
 (preencher)            │                           │
══════════════════════════════════════════════════════════════
```

**O que procurar:**

| Construção | O que significa funcionalmente |
|---|---|
| `CASE WHEN` | Regra de classificação, prioridade ou exibição |
| `COALESCE` | Fallback: prefere dado local, cai no alternativo |
| `CAST` / conversões | Regra de tipo ou formato esperado pelo consumidor |
| Concatenações | Composição de chave técnica ou rótulo de exibição |
| Flags derivadas (`1 = 1`, booleanos) | Regra de negócio resumida em sinal binário |
| `@Semantics.amount.currencyCode` | Vínculo semântico obrigatório para valores |
| `@Semantics.quantity.unitOfMeasure` | Vínculo semântico para quantidades |

**Saída:** catálogo de regras com efeito funcional de cada uma.

---

## ETAPA 8 — Leitura das Annotations como Pistas de Processo

Analise as annotations presentes e interprete seu significado funcional:

```
ANNOTATIONS RELEVANTES
══════════════════════════════════════════════════════════════════════════
 Annotation                        │ Indício Fornecido           │ Impacto Provável
───────────────────────────────────┼─────────────────────────────┼──────────────────────────
 (preencher)                       │                             │
══════════════════════════════════════════════════════════════════════════
```

**Heurísticas de interpretação rápida:**

| Annotation | Sinal funcional |
|---|---|
| Muitos `@UI.selectionField` | CDS alimenta list report / busca |
| `@UI.lineItem` + `@UI.identification` | Forte indício de Fiori Elements |
| `@Analytics.*` | CDS para dashboard, KPI ou analytical query |
| `@VDM.viewType: #BASIC` | Interface/base — não consumida diretamente |
| `@VDM.viewType: #CONSUMPTION` | Ponta da cadeia — Fiori / OData / Relatório |
| `@AccessControl.authorizationCheck` | Existe DCL associada — verificar |
| `@ObjectModel.text.association` | Enriquece outra view com descrição |
| Ausência de annotations UI | Provável consumo programático (classe ABAP, relatório) |

**Saída:** mapa de annotations com interpretação funcional.

---

## Anti-patterns desta etapa

| ❌ Anti-pattern | ✅ Correto |
|---|---|
| Descrever filtros como "detalhe técnico" | Registrar cada filtro e seu impacto no universo de dados |
| Ignorar `CASE WHEN` e `COALESCE` | Identificar a regra de negócio embutida |
| Não separar certeza de hipótese nos campos derivados | Classificar como evidência ou hipótese |
| Ler annotations sem interpretar o que revelam | Traduzir cada annotation em indício de consumo |
| Não registrar o que a CDS **não** entrega | Incluir explicitamente limitações por causa dos filtros |

---

## Saída desta skill

```
RESULTADO: ANÁLISE COMPORTAMENTAL
──────────────────────────────────
CDS: {nome}
Filtros identificados: {N filtros}
  Principais restrições: {ex: apenas registros ativos, apenas idioma da sessão}
Regras implícitas: {N regras}
  Destaques: {ex: StatusCalc derivado de CASE WHEN, fallback de texto via COALESCE}
Annotations relevantes: {N annotations}
  Perfil de consumo provável: {ex: Fiori Elements List Report + Object Page}
Alertas comportamentais: {ex: filtro de status pode excluir registros esperados}
```

Se esta análise faz parte de um fluxo completo, passe este bloco junto com o resultado
da `cds-structural-analysis` para a skill `cds-context-inference` continuar.