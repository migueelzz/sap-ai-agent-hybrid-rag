from collections import defaultdict


def reciprocal_rank_fusion(
    result_lists: list[list[dict]],
    k: int = 60,
    top_n: int = 10,
) -> list[dict]:
    """
    Funde N listas ordenadas usando RRF.
    Cada item deve ter campo 'id' (chunk_id).
    """
    scores: dict[int, float] = defaultdict(float)
    items:  dict[int, dict]  = {}

    for result_list in result_lists:
        for rank, item in enumerate(result_list):
            cid = item["id"]
            scores[cid] += 1.0 / (k + rank + 1)
            if cid not in items:
                items[cid] = item

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    return [
        {**items[cid], "rrf_score": round(score, 6)}
        for cid, score in ranked[:top_n]
    ]
