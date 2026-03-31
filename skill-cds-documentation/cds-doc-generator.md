---
name: cds-doc-generator
description: >
  Skill especializada em gerar o documento técnico-funcional final de análise de CDS
  Views ABAP. Executa as etapas 11 e 12: descrição objetiva do payload informacional
  e classificação do grau de confiança por dimensão. Produz o documento padronizado
  completo. Use esta skill quando o usuário quiser o documento de documentação gerado,
  ou ao final de qualquer análise completa de CDS. Ative quando o usuário pedir:
  "gera a documentação", "monta o documento final", "escreve o doc dessa CDS",
  "quero o template preenchido", "documenta essa view". Requer que as análises
  estrutural, comportamental e de contexto já tenham sido executadas.
---

# Skill: Geração de Documentação de CDS (Etapas 11–12)

## Responsabilidade

Esta skill responde à pergunta: **"Como documentar tudo isso de forma padronizada e confiável?"**

Cobre: síntese objetiva do payload informacional, classificação de confiança por dimensão
e geração do documento final completo.

**Pré-requisito:** resultados das skills `cds-structural-analysis`, `cds-behavior-analysis`
e `cds-context-inference` devem estar disponíveis.

---

## ETAPA 11 — Descrição do Payload Informacional

Descreva objetivamente o que a CDS entrega, respondendo:

- Quais registros entram no universo da CDS? (considerando os filtros da Etapa 6)
- Quais grupos de informação ela expõe?
- Quais campos são mais relevantes para o consumidor?
- Quais filtros alteram fortemente o resultado?
- Quais campos são técnicos vs. campos de negócio?
- O que a CDS **não** entrega? (limitações explícitas)

**Modelo de frase:**
> *"A CDS entrega [tipo de registro] com dados de [grupo 1], [grupo 2] e [grupo 3],
> incluindo [campos críticos], restritos por [filtros/regras principais]."*

**Saída:** resumo do conteúdo entregue, com limitações explícitas.

---

## ETAPA 12 — Classificação do Grau de Confiança

```
CONFIABILIDADE DA ANÁLISE
══════════════════════════════════════════════════════════════
 Dimensão               │ Grau          │ Justificativa
────────────────────────┼───────────────┼──────────────────────
 Processo de negócio    │ Alta/Média/Baixa │
 Entidade principal     │ Alta/Média/Baixa │
 Mapeamento de campos   │ Alta/Média/Baixa │
 Filtros e restrições   │ Alta/Média/Baixa │
══════════════════════════════════════════════════════════════

REFERÊNCIA:
• Alta   → confirmado por nome, estrutura E consumidor
• Média  → dados claros, processo inferido por indícios fortes
• Baixa  → estrutura entendida, processo depende de validação funcional

DÚVIDAS ABERTAS:
• [ ] _______________________________________________

VALIDAÇÕES NECESSÁRIAS COM KEY USER / FUNCIONAL:
• [ ] _______________________________________________
```

---

## Anti-patterns desta etapa

| ❌ Anti-pattern | ✅ Correto |
|---|---|
| Não registrar o que a CDS **não** entrega | Incluir explicitamente limitações e campos ausentes |
| Afirmar "Alta" confiança sem consumidor confirmado | Calibrar grau com base nas evidências reais disponíveis |
| Descrever apenas o `SELECT` no payload | Traduzir estrutura em impacto funcional para o consumidor |
| Não listar dúvidas abertas | Registrar cada ponto que requer validação com funcional |

---

## DOCUMENTO FINAL — Template de Saída

Ao final, gere o documento completo neste formato:

````markdown
# Documentação de Análise de CDS — {NOME_DA_CDS}

## 1. Identificação
- **Nome da CDS:** 
- **Pacote:** 
- **Tipo aparente:** 
- **Status da análise:** 

## 2. Resumo Executivo
[2–4 linhas explicando o que a CDS parece fazer, para quem existe e qual processo apoia]

## 3. Processo ou Cenário Suportado
- **Processo inferido:** 
- **Contexto de uso:** 
- **Grau de confiança:** 

## 4. Entidade Principal
- **Entidade central:** 
- **Motivo da conclusão:** 

## 5. Entidades Utilizadas
| Entidade | Tipo | Papel Funcional | Observação |
|---|---|---|---|

## 6. Relacionamentos
| Origem | Destino | Tipo | Cardinalidade | Finalidade |
|---|---|---|---|---|

## 7. Dados Entregues
| Campo | Origem | Significado Funcional | Categoria | Observação |
|---|---|---|---|---|

## 8. Filtros e Restrições
| Regra/Filtro | Tipo | Impacto no Resultado | Hipótese Funcional |
|---|---|---|---|

## 9. Regras Implícitas
| Regra | Evidência Técnica | Efeito Funcional |
|---|---|---|

## 10. Annotations Relevantes
| Annotation | Indício Fornecido | Impacto Provável |
|---|---|---|

## 11. Consumidores Conhecidos ou Prováveis
- **CDS relacionadas:** 
- **Serviço/UI:** 
- **Classe/programa:** 
- **Observações:** 

## 12. Payload Informacional
- **O que a CDS entrega:** 
- **Quais dados expõe:** 
- **Para quem provavelmente existe:** 
- **O que ela NÃO entrega:** 

## 13. Grau de Confiança da Análise
| Dimensão | Grau | Justificativa |
|---|---|---|
| Processo de negócio | | |
| Entidade principal | | |
| Mapeamento de campos | | |
| Filtros e restrições | | |

## 14. Dúvidas e Validações Pendentes
- [ ] 
- [ ] 
````