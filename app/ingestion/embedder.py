from __future__ import annotations
import re
import string
import numpy as np
import nltk
from nltk.corpus import stopwords
from nltk.stem import SnowballStemmer
from sentence_transformers import SentenceTransformer
from functools import lru_cache

nltk.download("punkt",     quiet=True)
nltk.download("stopwords", quiet=True)


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Singleton — carrega o modelo uma vez por processo."""
    return SentenceTransformer("paraphrase-MiniLM-L6-v2")


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"\s+", " ", text).strip()
    words = text.split()
    stop_words = set(stopwords.words("portuguese"))
    words = [w for w in words if w not in stop_words]
    stemmer = SnowballStemmer("portuguese")
    words = [stemmer.stem(w) for w in words]
    return " ".join(words)


def generate_embedding(text: str) -> list[float]:
    """Embedding para um único texto. Use batch_embeddings em ingestão."""
    model = _get_model()
    normalized = normalize_text(text)
    vector: np.ndarray = model.encode(normalized, normalize_embeddings=True)
    return vector.tolist()


def batch_embeddings(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """Geração em batch — use sempre durante ingestão."""
    model = _get_model()
    normalized = [normalize_text(t) for t in texts]
    vectors = model.encode(
        normalized,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    return [v.tolist() for v in vectors]
