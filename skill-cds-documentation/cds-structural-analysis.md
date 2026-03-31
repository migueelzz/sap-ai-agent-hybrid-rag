---
name: cds-structural-analysis
description: >
  Skill especializada na análise estrutural de CDS Views ABAP. Executa as etapas 0 a 5
  da análise: ficha inicial, classificação do tipo, fonte principal de dados, matriz de
  entidades envolvidas, mapeamento de relacionamentos e catálogo de campos entregues.
  Use esta skill SEMPRE que o usuário precisar entender a estrutura de uma CDS — mesmo
  que não peça análise completa. Ative quando o usuário perguntar: "quais campos essa
  CDS entrega?", "de onde vêm os dados?", "quais tabelas essa view usa?", "o que é essa
  entidade?", "qual o tipo dessa CDS?", ou quando colar um DDL source e quiser saber o
  que há dentro. É a primeira skill a executar em qualquer análise de CDS.
---

# Skill: Análise Estrutural de CDS (Etapas 0–5)

## Responsabilidade

Esta skill responde à pergunta: **"O que essa CDS é e o que ela contém?"**

Cobre: tipo da view, fonte de dados, entidades participantes, relacionamentos e campos
expostos. É sempre a primeira etapa de qualquer análise — completa ou parcial.

**Princípio central:** nunca interpretar uma CDS apenas pelo nome. Cada conclusão deve
ser classificada como evidência direta, indireta ou hipótese.

| Classificação | Definição |
|---|---|
| **Evidência direta** | Está explícita no código da CDS |
| **Evidência indireta** | Inferida por annotations, nomes, associações ou consumidores |
| **Hipótese** | Parece provável, mas requer validação funcional |

**Se o usuário fornecer o código-fonte:** inicie na Etapa 0 diretamente.
**Se o usuário fornecer apenas o nome:** solicite o DDL source antes de continuar, ou
instrua como exportá-lo via ADT (`clique direito na CDS → Open With → Source Code Editor`).

---

## ETAPA 0 — Ficha Inicial da CDS

```yaml
ficha_inicial:
  nome_cds: ""
  pacote: ""
  namespace: ""           # Z, Y ou standard SAP
  sistema_release: ""     # ECC, S/4HANA On-Premise, BTP ABAP
  tipo_aparente: ""       # interface, projection, consumption, value help, wrapper, analítica
  ddl_unico_ou_cadeia: "" # DDL único ou cadeia de views
  status_analise: "Em andamento"
```

---

## ETAPA 1 — Leitura do Cabeçalho e Classificação do Tipo

Analise:
- Nome técnico e label `@EndUserText.label`
- Keyword: `define view entity` vs `define root view entity`
- SQL View name (legado `@AbapCatalog.sqlViewName`)
- Annotations de cabeçalho presentes

**Responda obrigatoriamente:**

| Pergunta | Resposta | Evidência |
|---|---|---|
| Ela modela uma entidade principal? | | |
| Ela apenas projeta outra view? | | |
| Ela existe para UI (Fiori)? | | |
| Ela encapsula tabela/view não released? | | |

**Saída:** classificação inicial da natureza da CDS.

---

## ETAPA 2 — Identificação da Fonte Principal de Dados

Mapeie o `select from` principal:

```
FONTE PRINCIPAL:
  Tipo: [ ] Tabela DB  [ ] CDS standard  [ ] CDS custom  [ ] Join/view composta  [ ] Association base
  Nome: ______________________

ENTIDADE CENTRAL:
  Representa: [ ] Cabeçalho  [ ] Item  [ ] Texto  [ ] Configuração  [ ] Saldo  [ ] Status  [ ] Analytics
```

**Pergunta-chave:** *"Se eu tivesse que explicar esta CDS em uma frase, qual é o objeto
principal que ela representa?"*

**Saída:** entidade central da CDS com justificativa.

---

## ETAPA 3 — Levantamento de Todas as Entidades Envolvidas

Catalogue tudo que aparece na definição — fonte principal, joins, associations,
compositions, text associations, views auxiliares e tabelas referenciadas.

```
MATRIZ DE ENTIDADES
══════════════════════════════════════════════════════════════════
 Entidade             │ Tipo          │ Papel Funcional      │ Categoria de Dado
──────────────────────┼───────────────┼──────────────────────┼───────────────────
 (preencher)          │               │                      │
══════════════════════════════════════════════════════════════════

CATEGORIAS POSSÍVEIS:
Dado mestre | Transacional | Organizacional | Texto/Descrição |
Status | Moeda/Unidade | Configuração | Analítico
```

**Saída:** matriz completa de entidades e papéis.

---

## ETAPA 4 — Mapeamento de Relacionamentos e Cardinalidades

Para cada join/association, registre:

```
MAPA DE RELACIONAMENTOS
══════════════════════════════════════════════════════════════════════════════
 Origem     │ Destino    │ Tipo        │ Cardinalidade │ Condição ON    │ Finalidade Funcional
────────────┼────────────┼─────────────┼───────────────┼────────────────┼─────────────────────
 (preencher)│            │             │               │                │
══════════════════════════════════════════════════════════════════════════════
```

**Perguntas que orientam a análise de cada relacionamento:**
- É relação cabeçalho-item?
- É enriquecimento de texto ou descrição?
- É busca de status?
- É dado organizacional (empresa, planta, centro)?
- É apenas navegação para UI (association não usada em JOIN)?

⚠️ **Risco de multiplicidade:** joins 1:N sem filtro adequado podem inflar resultados.
Sinalize quando detectado.

**Saída:** mapa completo de relacionamentos.

---

## ETAPA 5 — Catálogo de Campos Entregues

Liste todos os campos do `select list` e classifique-os:

```
CATÁLOGO DE CAMPOS
══════════════════════════════════════════════════════════════════════════════════════════
 Campo Exposto     │ Origem Técnica │ Significado Funcional     │ Categoria    │ Obs
──────────────────┼────────────────┼───────────────────────────┼──────────────┼─────────
 (preencher)       │                │                           │              │
══════════════════════════════════════════════════════════════════════════════════════════

CATEGORIAS DE CAMPO:
Chave | Identificador | Organizacional | Data | Status | Descrição/Texto |
Quantidade/Unidade | Valor/Moeda | Calculado/Derivado | Técnico
```

**Pergunta-chave para cada campo:** *"O que um consumidor ganha ao ler este campo?"*

**Saída:** catálogo completo de campos.

---

## Anti-patterns desta etapa

| ❌ Anti-pattern | ✅ Correto |
|---|---|
| Tratar nome de campo como semântica garantida | Verificar origem e annotation antes de concluir |
| Ignorar o tipo de keyword (`define view` vs `define root`) | Classificar o tipo antes de qualquer outra análise |
| Catalogar campos sem explicar o significado funcional | Responder: "o que o consumidor ganha com este campo?" |
| Não detectar risco de multiplicidade em joins 1:N | Sinalizar explicitamente quando identificado |

---

## Sinais de tipo a reconhecer

### CDS Transacional
- Campos de documento, item, status, datas e organização
- Joins cabeçalho + item + texto
- Uso em projection view ou service definition

### CDS de Busca / Value Help
- Poucos campos (chave + descrição)
- Filtros de ativo/vigência
- Annotations `@UI.selectionField` ou `@Consumption.valueHelpDefinition`

### CDS Analítica
- Agregações, measures, dimensions
- Annotations `@Analytics.*` ou `@AnalyticsDetails.*`
- Indicadores, totais, comparativos

### Wrapper Técnico
- Nomes genéricos sem semântica funcional clara
- Foco em encapsular fonte não released
- Consumido exclusivamente por outra CDS superior

---

## Saída desta skill

Ao concluir as Etapas 0–5, produza um bloco de saída estruturado:

```
RESULTADO: ANÁLISE ESTRUTURAL
──────────────────────────────
CDS: {nome}
Tipo: {tipo classificado}
Entidade central: {entidade} ({justificativa})
Fonte principal: {tabela/CDS}
Entidades envolvidas: {N entidades mapeadas}
Campos catalogados: {N campos}
Alertas estruturais: {ex: risco de multiplicidade em JOIN VBAK→VBAP}
```

Se esta análise faz parte de um fluxo completo, passe este bloco para a skill
`cds-behavior-analysis` continuar.