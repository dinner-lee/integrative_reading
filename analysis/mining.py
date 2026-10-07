"""모둠 자료 묶기: TF-IDF + k-평균, LDA, BERTopic.

세 방법 모두 같은 모양의 결과를 돌려주어 화면에서 나란히 비교할 수 있게 한다.
결과에는 학습자가 '어떻게 묶였는지'를 설명할 수 있도록
낱말별 TF·IDF·가중치, 문서 간 유사도, 묶음 중심과의 거리 등을 담는다.
"""

from __future__ import annotations

import math
import os
from collections import Counter
from dataclasses import dataclass

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA, LatentDirichletAllocation, TruncatedSVD
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.metrics.pairwise import cosine_similarity

from preprocess import PreprocessOptions, tokenize


@dataclass
class Doc:
    id: str
    title: str
    text: str


@dataclass
class MiningOptions:
    k: int | None = None  # None이면 실루엣 점수로 추천
    min_df: int = 1  # 낱말이 최소 몇 개 자료에 나와야 하는지
    max_df: float = 1.0  # 너무 흔한 낱말 제외 비율(1.0이면 제외 안 함)
    ngram: int = 1  # 1: 낱말 하나, 2: 이웃한 두 낱말까지
    max_features: int = 2000
    seed: int = 42


def _identity(x):
    return x


def _ngrams(tokens: list[str], n: int) -> list[str]:
    if n <= 1:
        return tokens
    out = list(tokens)
    for i in range(len(tokens) - 1):
        out.append(f"{tokens[i]} {tokens[i + 1]}")
    return out


def _round(x: float, d: int = 4) -> float:
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return 0.0
    return round(float(x), d)


def _coords_2d(matrix) -> list[list[float]]:
    n = matrix.shape[0]
    if n < 3:
        return [[float(i), 0.0] for i in range(n)]
    try:
        if hasattr(matrix, "toarray"):
            reducer = TruncatedSVD(n_components=2, random_state=0)
            pts = reducer.fit_transform(matrix)
        else:
            pts = PCA(n_components=2, random_state=0).fit_transform(matrix)
    except ValueError:
        return [[float(i), 0.0] for i in range(n)]
    # -1~1 범위로 맞춰 화면에 그리기 쉽게
    span = np.abs(pts).max(axis=0)
    span[span == 0] = 1
    pts = pts / span
    return [[_round(x, 3), _round(y, 3)] for x, y in pts]


def suggest_k(matrix, k_max: int = 8, seed: int = 42) -> list[dict]:
    n = matrix.shape[0]
    out = []
    for k in range(2, min(k_max, n - 1) + 1):
        km = KMeans(n_clusters=k, n_init=10, random_state=seed).fit(matrix)
        if len(set(km.labels_)) < 2:
            continue
        out.append({"k": k, "silhouette": _round(silhouette_score(matrix, km.labels_, metric="cosine"))})
    return out


def _prepare(docs: list[Doc], pre: PreprocessOptions, opts: MiningOptions):
    pre_results = [tokenize(d.text, pre) for d in docs]
    token_lists = [_ngrams(r["tokens"], opts.ngram) for r in pre_results]
    warnings: list[str] = []
    empty = [d.title for d, t in zip(docs, token_lists) if not t]
    if empty:
        warnings.append(f"분석할 낱말이 하나도 남지 않은 자료가 있어요: {', '.join(empty)}")
    if len(docs) < 4:
        warnings.append("자료가 4개보다 적으면 묶음 결과가 불안정해요. 자료를 더 모아 보세요.")
    preprocessing = [
        {
            "id": d.id,
            "title": d.title,
            "stats": r["stats"],
            "removed": r["removed"],
            "morphemes": r["morphemes"],
            "tokensPreview": r["tokens"][:80],
        }
        for d, r in zip(docs, pre_results)
    ]
    return token_lists, preprocessing, warnings


def _effective_min_df(opts: MiningOptions, n_docs: int) -> int:
    return max(1, min(opts.min_df, n_docs))


def _resolve_k(matrix, opts: MiningOptions, n_docs: int, warnings: list[str]):
    candidates = suggest_k(matrix, seed=opts.seed) if n_docs >= 4 else []
    if opts.k:
        k = opts.k
    elif candidates:
        k = max(candidates, key=lambda c: c["silhouette"])["k"]
    else:
        k = min(2, n_docs)
    if k > n_docs:
        warnings.append(f"묶음 수({k})가 자료 수({n_docs})보다 많아서 {n_docs}개로 줄였어요.")
        k = n_docs
    return max(1, k), candidates


def run_tfidf_kmeans(docs: list[Doc], pre: PreprocessOptions, opts: MiningOptions) -> dict:
    token_lists, preprocessing, warnings = _prepare(docs, pre, opts)
    n = len(docs)
    vec = TfidfVectorizer(
        analyzer=_identity,
        min_df=_effective_min_df(opts, n),
        max_df=opts.max_df if opts.max_df < 1 else 1.0,
        max_features=opts.max_features,
        sublinear_tf=False,
        norm="l2",
    )
    try:
        X = vec.fit_transform(token_lists)
    except ValueError:
        raise ValueError("조건에 맞는 낱말이 없어요. 불용어나 최소 등장 자료 수를 줄여 보세요.")
    vocab = vec.get_feature_names_out()
    idf = vec.idf_

    k, candidates = _resolve_k(X, opts, n, warnings)
    km = KMeans(n_clusters=k, n_init=10, random_state=opts.seed).fit(X)
    labels = km.labels_
    centroids = km.cluster_centers_
    dense = X.toarray()

    sim_to_centroid = cosine_similarity(dense, centroids)
    sim = cosine_similarity(dense)

    docs_out = []
    for i, d in enumerate(docs):
        row = dense[i]
        counts = Counter(token_lists[i])
        top_idx = np.argsort(-row)[:10]
        top_terms = [
            {
                "term": vocab[j],
                "tf": counts.get(vocab[j], 0),
                "idf": _round(idf[j], 3),
                "weight": _round(row[j]),
            }
            for j in top_idx
            if row[j] > 0
        ]
        docs_out.append(
            {
                "id": d.id,
                "title": d.title,
                "cluster": int(labels[i]),
                "fit": _round(sim_to_centroid[i, labels[i]]),
                "tokenCount": len(token_lists[i]),
                "topTerms": top_terms,
            }
        )

    coords = _coords_2d(X)
    for d, c in zip(docs_out, coords):
        d["coords"] = c

    clusters = []
    for c in range(k):
        center = centroids[c]
        idx = np.argsort(-center)[:12]
        clusters.append(
            {
                "id": c,
                "size": int((labels == c).sum()),
                "terms": [{"term": vocab[j], "weight": _round(center[j])} for j in idx if center[j] > 0],
                "docIds": [docs[i].id for i in range(n) if labels[i] == c],
            }
        )

    metrics = {"inertia": _round(km.inertia_, 3)}
    if 2 <= k < n:
        metrics["silhouette"] = _round(silhouette_score(X, labels, metric="cosine"))

    return {
        "method": "tfidf_kmeans",
        "k": k,
        "vocabSize": len(vocab),
        "docs": docs_out,
        "clusters": clusters,
        "similarity": [[_round(v, 3) for v in r] for r in sim],
        "metrics": metrics,
        "kCandidates": candidates,
        "preprocessing": preprocessing,
        "warnings": warnings,
    }


def run_lda(docs: list[Doc], pre: PreprocessOptions, opts: MiningOptions) -> dict:
    token_lists, preprocessing, warnings = _prepare(docs, pre, opts)
    n = len(docs)
    vec = CountVectorizer(
        analyzer=_identity,
        min_df=_effective_min_df(opts, n),
        max_df=opts.max_df if opts.max_df < 1 else 1.0,
        max_features=opts.max_features,
    )
    try:
        X = vec.fit_transform(token_lists)
    except ValueError:
        raise ValueError("조건에 맞는 낱말이 없어요. 불용어나 최소 등장 자료 수를 줄여 보세요.")
    vocab = vec.get_feature_names_out()

    k = opts.k or min(3, n)
    k = max(1, min(k, n))
    lda = LatentDirichletAllocation(
        n_components=k, random_state=opts.seed, learning_method="batch", max_iter=100
    )
    theta = lda.fit_transform(X)  # 문서별 주제 비중
    phi = lda.components_ / lda.components_.sum(axis=1, keepdims=True)  # 주제별 낱말 확률

    dominant = theta.argmax(axis=1)
    docs_out = []
    for i, d in enumerate(docs):
        counts = Counter(token_lists[i])
        docs_out.append(
            {
                "id": d.id,
                "title": d.title,
                "cluster": int(dominant[i]),
                "fit": _round(theta[i, dominant[i]]),
                "tokenCount": len(token_lists[i]),
                "topicDist": [_round(v, 3) for v in theta[i]],
                "topTerms": [{"term": w, "tf": c, "idf": 0, "weight": c} for w, c in counts.most_common(10)],
            }
        )
    coords = _coords_2d(theta) if k > 2 else _coords_2d(X)
    for d, c in zip(docs_out, coords):
        d["coords"] = c

    clusters = []
    for t in range(k):
        idx = np.argsort(-phi[t])[:12]
        clusters.append(
            {
                "id": t,
                "size": int((dominant == t).sum()),
                "terms": [{"term": vocab[j], "weight": _round(phi[t, j])} for j in idx],
                "docIds": [docs[i].id for i in range(n) if dominant[i] == t],
            }
        )

    mixed = [docs_out[i]["title"] for i in range(n) if theta[i].max() < 0.6]
    if mixed:
        warnings.append(
            "한 주제가 60%를 넘지 않는 자료가 있어요(여러 주제가 섞여 있음): " + ", ".join(mixed)
        )

    metrics = {"perplexity": _round(lda.perplexity(X), 2)}
    return {
        "method": "lda",
        "k": k,
        "vocabSize": len(vocab),
        "docs": docs_out,
        "clusters": clusters,
        "similarity": [[_round(v, 3) for v in r] for r in cosine_similarity(theta)],
        "metrics": metrics,
        "kCandidates": [],
        "preprocessing": preprocessing,
        "warnings": warnings,
    }


def bertopic_available() -> bool:
    try:
        import bertopic  # noqa: F401
        import sentence_transformers  # noqa: F401

        return True
    except ImportError:
        return False


_EMBEDDER = None


def _embedder():
    global _EMBEDDER
    if _EMBEDDER is None:
        from sentence_transformers import SentenceTransformer

        _EMBEDDER = SentenceTransformer(
            os.environ.get("BERTOPIC_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
        )
    return _EMBEDDER


def run_bertopic(docs: list[Doc], pre: PreprocessOptions, opts: MiningOptions) -> dict:
    if not bertopic_available():
        raise RuntimeError("BERTopic이 설치되어 있지 않아요(requirements-bertopic.txt).")
    from bertopic import BERTopic

    token_lists, preprocessing, warnings = _prepare(docs, pre, opts)
    n = len(docs)
    if n < 3:
        raise ValueError("BERTopic은 자료가 3개 이상 있어야 해요.")
    texts = [d.text[:4000] for d in docs]
    emb = _embedder().encode(texts, show_progress_bar=False, normalize_embeddings=True)

    k = opts.k or max(2, min(5, n // 3))
    k = min(k, n)
    # 자료 수가 적은 교실 상황: UMAP/HDBSCAN 대신 PCA + k-평균을 쓴다.
    topic_model = BERTopic(
        umap_model=PCA(n_components=min(5, n - 1), random_state=opts.seed),
        hdbscan_model=KMeans(n_clusters=k, n_init=10, random_state=opts.seed),
        vectorizer_model=CountVectorizer(tokenizer=str.split, token_pattern=None, lowercase=False),
        calculate_probabilities=False,
    )
    # 임베딩은 원문으로 만들고, 묶음 대표 낱말(c-TF-IDF)은 전처리한 낱말로 계산한다.
    joined = [" ".join(t) for t in token_lists]
    labels, _ = topic_model.fit_transform(joined, embeddings=emb)
    labels = np.array(labels)
    topics = sorted(set(labels.tolist()))
    centroids = np.vstack([emb[labels == t].mean(axis=0) for t in topics])
    sim_to_centroid = cosine_similarity(emb, centroids)
    topic_index = {t: i for i, t in enumerate(topics)}

    docs_out = []
    for i, d in enumerate(docs):
        counts = Counter(token_lists[i])
        ti = topic_index[int(labels[i])]
        docs_out.append(
            {
                "id": d.id,
                "title": d.title,
                "cluster": ti,
                "fit": _round(sim_to_centroid[i, ti]),
                "tokenCount": len(token_lists[i]),
                "topTerms": [{"term": w, "tf": c, "idf": 0, "weight": c} for w, c in counts.most_common(10)],
            }
        )
    for d, c in zip(docs_out, _coords_2d(emb)):
        d["coords"] = c

    clusters = []
    for t in topics:
        words = topic_model.get_topic(t) or []
        clusters.append(
            {
                "id": topic_index[t],
                "size": int((labels == t).sum()),
                "terms": [{"term": w, "weight": _round(s)} for w, s in words[:12]],
                "docIds": [docs[i].id for i in range(n) if labels[i] == t],
            }
        )

    metrics = {}
    if 2 <= len(topics) < n:
        metrics["silhouette"] = _round(silhouette_score(emb, labels, metric="cosine"))
    return {
        "method": "bertopic",
        "k": len(topics),
        "vocabSize": len(topic_model.vectorizer_model.get_feature_names_out()),
        "docs": docs_out,
        "clusters": clusters,
        "similarity": [[_round(v, 3) for v in r] for r in cosine_similarity(emb)],
        "metrics": metrics,
        "kCandidates": [],
        "preprocessing": preprocessing,
        "warnings": warnings,
    }


METHODS = {
    "tfidf_kmeans": run_tfidf_kmeans,
    "lda": run_lda,
    "bertopic": run_bertopic,
}
