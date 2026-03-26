from __future__ import annotations
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    document_id: int
    chunk_index: int
    content: str
    tokens: int


def _split_paragraphs(text: str) -> list[str]:
    """Divide por linha dupla; normaliza múltiplas quebras antes."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    return [p.strip() for p in text.split('\n\n') if p.strip()]


def _force_split(text: str, max_tokens: int, overlap: int) -> list[str]:
    """Quebra forçada por tokens quando parágrafo é maior que max_tokens."""
    words = text.split()
    result = []
    i = 0
    while i < len(words):
        chunk = words[i: i + max_tokens]
        result.append(" ".join(chunk))
        i += max_tokens - overlap
    return result


def chunk_text(
    text: str,
    max_tokens: int = 400,
    overlap_tokens: int = 60,
) -> list[str]:
    paragraphs = _split_paragraphs(text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for para in paragraphs:
        para_words = para.split()
        para_len   = len(para_words)

        # Parágrafo sozinho maior que max → quebra forçada por tokens
        if para_len > max_tokens:
            sub_chunks = _force_split(para, max_tokens, overlap_tokens)
            for sub in sub_chunks:
                chunks.append(sub)
            continue

        if current_len + para_len > max_tokens and current:
            chunks.append(" ".join(current))
            # Overlap: mantém últimas N palavras
            overlap_words = " ".join(current).split()[-overlap_tokens:]
            current = list(overlap_words)
            current_len = len(current)

        current.extend(para_words)
        current_len += para_len

    if current:
        chunks.append(" ".join(current))

    return [c for c in chunks if len(c.strip()) > 30]   # descarta chunks triviais


def build_chunks(document_id: int, raw_text: str) -> list[Chunk]:
    raw = chunk_text(raw_text)
    return [
        Chunk(
            document_id=document_id,
            chunk_index=idx,
            content=content,
            tokens=len(content.split()),
        )
        for idx, content in enumerate(raw)
    ]
