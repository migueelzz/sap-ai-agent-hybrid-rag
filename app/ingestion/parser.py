from __future__ import annotations
import fitz          # PyMuPDF
import pdfplumber
from dataclasses import dataclass, field

TITLE_FONT_THRESHOLD = 13.0   # fonte acima disso = título de seção


@dataclass
class ParsedSection:
    title: str
    page_start: int
    page_end: int
    raw_text: str
    tables: list[list[list[str]]] = field(default_factory=list)


def _is_title(span: dict) -> bool:
    """Heurística: fonte grande + bold + texto curto = título."""
    is_large = span["size"] >= TITLE_FONT_THRESHOLD
    is_bold  = "Bold" in span.get("font", "") or bool(span.get("flags", 0) & 2**4)
    is_short = len(span["text"].strip()) < 120
    has_text = len(span["text"].strip()) > 3
    return is_large and is_bold and is_short and has_text


def parse_pdf(filepath: str) -> list[ParsedSection]:
    doc = fitz.open(filepath)
    sections: list[ParsedSection] = []

    current_title: str | None = None
    current_lines: list[str] = []
    current_start = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        for block in blocks:
            if block.get("type") != 0:   # 0 = texto
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue

                    if _is_title(span):
                        # Salvar seção anterior (só se tiver título real)
                        if current_title is not None and current_lines:
                            sections.append(ParsedSection(
                                title=current_title,
                                page_start=current_start,
                                page_end=page_num,
                                raw_text="\n".join(current_lines),
                            ))
                        current_title = text
                        current_lines = []
                        current_start = page_num
                    else:
                        current_lines.append(text)

    # Última seção
    if current_lines:
        sections.append(ParsedSection(
            title=current_title,
            page_start=current_start,
            page_end=len(doc) - 1,
            raw_text="\n".join(current_lines),
        ))

    doc.close()

    # Enriquecer com tabelas via pdfplumber
    _attach_tables(filepath, sections)

    return sections


def _attach_tables(filepath: str, sections: list[ParsedSection]) -> None:
    """Extrai tabelas e vincula à seção correspondente."""
    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables() or []
            for section in sections:
                if section.page_start <= page_num <= section.page_end:
                    section.tables.extend(tables)
