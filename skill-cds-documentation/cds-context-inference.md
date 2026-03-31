---
name: cds-context-inference
description: >
  Skill especializada em inferir o contexto de uso de CDS Views ABAP. Executa as etapas
  9 e 10 da análise: mapeamento de consumidores conhecidos ou prováveis, e inferência do
  processo de negócio suportado pela view. Use esta skill quando o usuário quiser entender
  PARA QUÊ e PARA QUEM a CDS existe. Ative quando o usuário perguntar: "quem usa essa
  CDS?", "em qual processo essa view é usada?", "essa CDS alimenta qual app Fiori?",
  "ela faz parte de qual módulo?", "qual processo de negócio ela apoia?". Executar após
  cds-structural-analysis e cds-behavior-analysis em análises completas.
---

# Skill: Inferência de Contexto de CDS (Etapas 9–10)

## Responsabilidade

Esta skill responde à pergunta: **"Para quem essa CDS existe e qual processo ela apoia?"**

Cobre: identificação de consumidores (CDS filhas, programas, apps Fiori, serviços OData)
e inferência fundamentada do processo de negócio — sempre com grau de confiança explícito.

**Pré-requisito:** os resultados de `cds-structural-analysis` e `cds-behavior-analysis`
devem estar disponíveis.

---

## ETAPA 9 — Mapeamento de Consumidores

Mapeie onde a CDS é usada. Se o usuário não forneceu, instrua como obter via ADT:

```
ADT: clique direito na CDS → "Where Used List" → filtrar por tipo de objeto
```

```
CONSUMIDORES IDENTIFICADOS
┌────────────────────────┬──────────────────────┬──────────────────────────────┐
│ Consumidor             │ Tipo                 │ Contexto de Uso              │
├────────────────────────┼──────────────────────┼──────────────────────────────┤
│ (preencher)            │                      │                              │
└────────────────────────┴──────────────────────┴──────────────────────────────┘

TIPOS DE CONSUMIDOR:
Projection View | Service Definition | Programa ABAP |
App Fiori Elements | Query Analítica | Classe ABAP | Relatório ALV
```

⚠️ **Importância:** a CDS sozinha pode não revelar o processo completo.
O consumidor frequentemente **confirma ou refuta** a hipótese de processo.

**Se não houver consumidores fornecidos:** infira consumidores prováveis com base nas
annotations e no tipo da CDS (ex: `@VDM.viewType: #CONSUMPTION` → consumida diretamente
por OData ou Fiori).

**Saída:** mapa de consumidores reais ou prováveis, com contexto de uso.

---

## ETAPA 10 — Inferência do Processo de Negócio

Com base em todas as etapas anteriores, escreva a hipótese de processo usando esta
fórmula:

```
[entidade principal] + [ação de negócio implícita] + [contexto de consumo] + [restrições principais]
```

**Exemplos de saída bem estruturada:**
- *"A CDS entrega pedidos de compra e seus dados principais para acompanhamento operacional em list report."*
- *"A CDS entrega itens de documento de faturamento com textos e status para consumo analítico."*
- *"A CDS funciona como value help para seleção de centro/planta ativos."*

**Regra inegociável:** se a evidência não for suficiente, escreva como hipótese e
marque necessidade de validação funcional. **Nunca afirme processo sem evidência.**

**Saída:** descrição do processo/cenário suportado, com grau de confiança.

---

## Heurísticas de processo por tipo de CDS

Use como referência ao formular a hipótese:

### Sinais de CDS Transacional
- Campos de documento com cabeçalho, item, status e datas
- Joins com tabelas de movimento (ex: VBAK, EKKO, BKPF)
- Consumida por projection view ou service definition
- → *"Suporta acompanhamento operacional de [objeto de negócio]"*

### Sinais de CDS de Busca / Value Help
- Poucos campos: chave + descrição
- Filtro de ativo/vigência obrigatório
- Annotation `@Consumption.valueHelpDefinition`
- → *"Fornece lista de valores para seleção de [entidade] em formulário ou filtro"*

### Sinais de CDS Analítica
- Agregações, measures com `@DefaultAggregation`, dimensions
- Annotations `@Analytics.dataCategory: #FACT`
- → *"Alimenta dashboard ou KPI para acompanhamento de [indicador]"*

### Sinais de Wrapper / Interface
- Consome tabela não released ou CDS legada
- Sem annotations de UI
- Consumida exclusivamente por outra CDS
- → *"Encapsula [fonte] para isolamento da camada de acesso"*

---

## Anti-patterns desta etapa

| ❌ Anti-pattern | ✅ Correto |
|---|---|
| Afirmar processo sem evidência técnica | Classificar como hipótese e marcar validação necessária |
| Ignorar os consumidores ao inferir processo | Usar consumidor como confirmação ou refutação |
| Descrever processo de forma vaga ("apoia SD") | Ser específico: entidade + ação + contexto + restrições |
| Assumir que a CDS sozinha revela o processo completo | Buscar evidências na cadeia de views e consumidores |

---

## Saída desta skill

```
RESULTADO: INFERÊNCIA DE CONTEXTO
──────────────────────────────────
CDS: {nome}
Consumidores identificados: {N} ({lista resumida})
Consumidores prováveis (se não confirmados): {lista}
Processo inferido: "{frase usando a fórmula}"
Grau de confiança no processo: Alta / Média / Baixa
  Justificativa: {por que esse grau}
Validações necessárias com key user / funcional:
  - [ ] {ponto de incerteza 1}
  - [ ] {ponto de incerteza 2}
```

Se esta análise faz parte de um fluxo completo, passe todos os resultados acumulados
para a skill `cds-doc-generator` produzir o documento final.