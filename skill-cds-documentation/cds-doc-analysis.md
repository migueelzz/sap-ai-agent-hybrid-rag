---
name: cds-doc-analysis
description: >
  Skill orquestradora para análise completa de CDS Views ABAP sem documentação. Coordena
  automaticamente em sequência as quatro skills especializadas: análise estrutural,
  comportamental, inferência de contexto e geração do documento final. Use esta skill
  SEMPRE que o usuário pedir análise completa ou documentação de uma CDS — mesmo que
  não use esses termos exatos. Ative quando o usuário: colar código-fonte de uma CDS e
  pedir análise, perguntar "o que esta CDS faz?", pedir para documentar uma CDS, pedir
  para entender uma view desconhecida, mencionar "CDS sem documentação", "CDS legada",
  "reverse engineering de CDS", "gerar documentação de CDS", "analisar CDS", "documentar
  view ABAP", "entender esta view", "o que essa CDS retorna?", ou compartilhar um DDL
  source esperando explicação funcional ou técnica. Para análises parciais (ex: "só
  quero os campos"), use diretamente a skill especializada correspondente.
---

# Skill: Análise Completa de CDS — Orquestrador

## Visão Geral

Esta skill coordena uma análise estruturada de **12 etapas** divididas em **4 fases**,
cada uma executada por uma skill especializada. O resultado final é um documento técnico
e funcional completo que responde às perguntas essenciais sobre a CDS.

**Princípio central:** nunca interpretar uma CDS apenas pelo nome. Cada conclusão deve
ser classificada como evidência direta, evidência indireta ou hipótese.

| Classificação | Definição |
|---|---|
| **Evidência direta** | Está explícita no código da CDS |
| **Evidência indireta** | Inferida por annotations, nomes, associações ou consumidores |
| **Hipótese** | Parece provável, mas requer validação funcional |

---

## Pré-condição de entrada

**Se o usuário fornecer o código-fonte:** inicie a Fase 1 diretamente.

**Se o usuário fornecer apenas o nome da CDS:** solicite o DDL source antes de continuar.
Instrua como exportá-lo:
> *"Para exportar o DDL source via ADT: clique direito na CDS → Open With → Source Code Editor.
> Cole o conteúdo completo aqui para iniciar a análise."*

---

## Fluxo de Execução

Execute as fases **em sequência**, acumulando os resultados de cada fase antes de
avançar para a próxima. Não pule etapas.

```
DDL Source fornecido
        │
        ▼
┌───────────────────────────┐
│  FASE 1                   │  Skill: cds-structural-analysis
│  Análise Estrutural       │  Etapas 0–5: tipo, fontes, entidades,
│  (O que é e o que contém) │  relacionamentos, campos
└────────────┬──────────────┘
             │  → Bloco "RESULTADO: ANÁLISE ESTRUTURAL"
             ▼
┌───────────────────────────┐
│  FASE 2                   │  Skill: cds-behavior-analysis
│  Análise Comportamental   │  Etapas 6–8: filtros, regras implícitas,
│  (Como ela se comporta)   │  annotations
└────────────┬──────────────┘
             │  → Bloco "RESULTADO: ANÁLISE COMPORTAMENTAL"
             ▼
┌───────────────────────────┐
│  FASE 3                   │  Skill: cds-context-inference
│  Inferência de Contexto   │  Etapas 9–10: consumidores,
│  (Para quem e por quê)    │  processo de negócio
└────────────┬──────────────┘
             │  → Bloco "RESULTADO: INFERÊNCIA DE CONTEXTO"
             ▼
┌───────────────────────────┐
│  FASE 4                   │  Skill: cds-doc-generator
│  Geração do Documento     │  Etapas 11–12: payload informacional,
│  (Documentação final)     │  grau de confiança, documento final
└───────────────────────────┘
             │
             ▼
     Documento final completo
```

---

## Instruções de Execução

### Fase 1 — Análise Estrutural
Leia e execute a skill `cds-structural-analysis` (Etapas 0–5).
Produza o bloco de saída estruturado ao final desta fase antes de prosseguir.

### Fase 2 — Análise Comportamental
Leia e execute a skill `cds-behavior-analysis` (Etapas 6–8).
Use o resultado da Fase 1 como contexto. Produza o bloco de saída antes de prosseguir.

### Fase 3 — Inferência de Contexto
Leia e execute a skill `cds-context-inference` (Etapas 9–10).
Use os resultados das Fases 1 e 2 como contexto. Produza o bloco de saída antes de prosseguir.

### Fase 4 — Geração do Documento
Leia e execute a skill `cds-doc-generator` (Etapas 11–12).
Use todos os resultados acumulados das Fases 1–3. Gere o documento final completo.

---

## Uso Parcial (análise de fase única)

Se o usuário precisar apenas de parte da análise, use a skill especializada diretamente:

| Necessidade do usuário | Skill a usar |
|---|---|
| "Quais campos essa CDS entrega?" | `cds-structural-analysis` |
| "De onde vêm os dados?" | `cds-structural-analysis` |
| "Por que ela não retorna todos os registros?" | `cds-behavior-analysis` |
| "O que esse CASE WHEN significa?" | `cds-behavior-analysis` |
| "Quem usa essa CDS?" | `cds-context-inference` |
| "Qual processo ela apoia?" | `cds-context-inference` |
| "Gera o documento final" | `cds-doc-generator` (requer fases anteriores) |
| "Análise completa / documentação" | Este orquestrador (todas as fases) |

---

## Referências para RAG Search

Use estas queries ao longo da análise quando precisar de contexto externo:

- `"[nome da tabela/CDS] significado funcional [módulo]"`
- `"annotations CDS [tipo de annotation]"`
- `"VDM view type [consumption/interface/basic]"`
- `"[módulo] entidades de negócio CDS released"`
- `"CDS value help annotations"`
- `"CDS analítica annotations"`
- `"Access Control DCL CDS"`

Se o RAG retornar resultados insuficientes, use `web_search` com:
- `site:help.sap.com "[nome da tabela]" field description`
- `SAP S/4HANA CDS [annotation type] documentation`