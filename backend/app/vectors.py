import math


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity; also correct for unnormalised vectors (e.g. reduced-dimension embeddings)."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
