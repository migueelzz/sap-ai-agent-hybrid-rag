"""
Processamento de imagens para uso como contexto de sessão (visão multimodal).

Segurança implementada:
- Proteção contra decompression bombs via PIL.Image.MAX_IMAGE_PIXELS
- Validação de dimensões máximas
- Conversão para RGB (remove alpha/CMYK)
- Remoção de EXIF (GPS, câmera, autor, etc.)
- Redimensionamento para 1024px (reduz custo de tokens LLM)
- Normalização para JPEG (formato canônico, sem surpresas de parsing)
"""

from __future__ import annotations

import base64
from io import BytesIO

from PIL import Image

from app.config import settings

# Proteção contra decompression bomb — deve ser definida antes de qualquer Image.open()
MAX_IMAGE_DIMENSION = 4096
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION

TARGET_DIMENSION = 1024   # redimensiona long-edge para este valor


def process_image(data: bytes, mime_type: str) -> tuple[bytes, str, tuple[int, int]]:
    """
    Valida, redimensiona e remove EXIF da imagem.

    Args:
        data: bytes brutos da imagem.
        mime_type: MIME confirmado por magic bytes (ex: "image/jpeg").

    Returns:
        Tupla (processed_bytes, "image/jpeg", (width, height))

    Raises:
        ValueError: em decompression bomb, dimensões inválidas ou formato corrompido.
    """
    try:
        img = Image.open(BytesIO(data))
    except Image.DecompressionBombWarning as exc:
        raise ValueError(
            "Imagem muito grande (possível decompression bomb). "
            "Envie uma imagem com resolução menor."
        ) from exc
    except Exception as exc:
        raise ValueError(f"Não foi possível abrir a imagem: {exc}") from exc

    w, h = img.size
    if w > MAX_IMAGE_DIMENSION or h > MAX_IMAGE_DIMENSION:
        raise ValueError(
            f"Imagem com dimensões {w}×{h}px excede o limite de "
            f"{MAX_IMAGE_DIMENSION}×{MAX_IMAGE_DIMENSION}px."
        )

    # Converte para RGB — remove alpha (RGBA/PA) e normaliza CMYK/P
    img = img.convert("RGB")

    # Redimensiona mantendo aspect ratio (thumbnail não amplia)
    img.thumbnail((TARGET_DIMENSION, TARGET_DIMENSION), Image.LANCZOS)

    out_w, out_h = img.size

    buf = BytesIO()
    # exif=b"" remove todos os metadados EXIF (inclui GPS, câmera, autor)
    # optimize=True: segunda passagem Huffman — poupa 5-10% sem perda de qualidade
    img.save(buf, format="JPEG", quality=settings.image_jpeg_quality, optimize=True, exif=b"")
    processed_bytes = buf.getvalue()

    return processed_bytes, "image/jpeg", (out_w, out_h)


def image_to_base64(data: bytes) -> str:
    """Codifica bytes para string base64 (sem quebras de linha)."""
    return base64.b64encode(data).decode("ascii")


def build_image_content_block(data: bytes, mime_type: str) -> dict:
    """
    Constrói o bloco de conteúdo LangChain para envio de imagem via visão multimodal.

    Compatível com OpenAI vision API e Google Gemini via endpoint compatível.

    Args:
        data: bytes processados da imagem.
        mime_type: MIME da imagem processada (tipicamente "image/jpeg").

    Returns:
        Dict no formato {"type": "image_url", "image_url": {"url": "data:...", "detail": "high"}}
    """
    b64 = image_to_base64(data)
    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime_type};base64,{b64}",
            "detail": "high",
        },
    }
