from __future__ import annotations
import re
from dataclasses import dataclass


@dataclass
class Entity:
    chunk_id: int
    tipo: str
    valor: str
    contexto: str


# ─── Padrões determinísticos ────────────────────────────────
_RE_TRANSACAO = re.compile(r'\b([A-Z]{1,4}\d{2,4}[A-Z]?)\b')
_RE_CDS       = re.compile(r'\b([IC]_[A-Z][A-Za-z0-9_]{3,})\b')

# Tabelas SAP conhecidas por módulo
_TABELAS_SAP = {
    "FI": {"BKPF", "BSEG", "SKA1", "SKB1", "T001", "T030"},
    "MM": {"EKKO", "EKPO", "MARA", "MARC", "MAKT", "T024"},
    "SD": {"VBAK", "VBAP", "LIKP", "LIPS", "VBRK", "VBRP"},
    "CO": {"COSP", "COSS", "CSKS", "CSKT", "AUFK"},
}
_TODOS_TABELAS = {t for s in _TABELAS_SAP.values() for t in s}

_TERMOS = {
    "FI": [
        "lançamento contábil", "partida simples", "partida dupla",
        "documento contábil", "plano de contas", "razão", "balancete",
        "centro de lucro", "nota de débito", "nota de crédito",
    ],
    "CO": [
        "centro de custo", "ordem interna", "resultado analítico",
        "rateio", "distribuição", "liquidação", "controlling",
    ],
    "MM": [
        "pedido de compra", "recebimento de mercadoria", "nota fiscal",
        "fornecedor", "requisição de compra", "contrato", "cotação",
    ],
    "SD": [
        "pedido de venda", "faturamento", "entrega", "cliente",
        "ordem de venda", "condição de preço", "expedição",
    ],
}


def extract_entities(chunk_id: int, content: str) -> list[Entity]:
    entities: list[Entity] = []
    content_up = content.upper()

    def _ctx(match) -> str:
        s = max(0, match.start() - 50)
        e = min(len(content), match.end() + 50)
        return content[s:e].replace("\n", " ")

    # Transações
    for m in _RE_TRANSACAO.finditer(content_up):
        entities.append(Entity(chunk_id, "transacao", m.group(1), _ctx(m)))

    # CDS Views
    for m in _RE_CDS.finditer(content):
        entities.append(Entity(chunk_id, "cds", m.group(1), _ctx(m)))

    # Tabelas (apenas as conhecidas no dicionário)
    for word in set(content_up.split()):
        clean = re.sub(r'[^A-Z0-9]', '', word)
        if clean in _TODOS_TABELAS:
            entities.append(Entity(chunk_id, "tabela", clean, content[:80]))

    # Termos por módulo
    content_low = content.lower()
    for modulo, termos in _TERMOS.items():
        for termo in termos:
            if termo in content_low:
                idx = content_low.index(termo)
                ctx = content[max(0, idx - 30): idx + len(termo) + 30]
                entities.append(Entity(chunk_id, "termo", termo, ctx))

    # Deduplicar por (tipo, valor)
    seen = set()
    unique = []
    for e in entities:
        key = (e.tipo, e.valor)
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique
