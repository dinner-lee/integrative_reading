"""간단한 동작 확인: .venv/bin/python test_mining.py"""

import json

from mining import Doc, MiningOptions, run_lda, run_tfidf_kmeans
from preprocess import PreprocessOptions

SAMPLES = {
    "a": "자전거 통학은 학생의 건강을 지키고 체력을 높인다. 매일 자전거를 타면 심폐 기능이 좋아진다.",
    "b": "자전거 통학로에는 차도와 분리된 자전거 도로가 필요하다. 안전모 착용과 교통 안전 교육이 중요하다.",
    "c": "신상 자전거 할인 행사! 가벼운 알루미늄 자전거를 지금 구매하세요. 자전거 자전거 최저가.",
    "d": "학교 앞 교통사고를 줄이려면 통학로 안전 시설을 늘려야 한다. 횡단보도와 신호등 설치가 필요하다.",
    "e": "자전거 이용은 탄소 배출을 줄여 환경을 보호한다. 기후 변화 대응에 도움이 된다.",
    "f": "규칙적인 운동은 청소년 건강과 체력 향상에 효과적이다. 자전거 타기는 좋은 유산소 운동이다.",
}


def main():
    docs = [Doc(k, k, v) for k, v in SAMPLES.items()]
    r = run_tfidf_kmeans(docs, PreprocessOptions(), MiningOptions())
    print("tfidf k=", r["k"], r["kCandidates"], r["metrics"])
    for c in r["clusters"]:
        print(" ", c["docIds"], [t["term"] for t in c["terms"][:5]])
    print("  top terms a:", r["docs"][0]["topTerms"][:3])
    assert sum(c["size"] for c in r["clusters"]) == len(docs)

    r = run_lda(docs, PreprocessOptions(), MiningOptions(k=3))
    print("lda", r["metrics"])
    for c in r["clusters"]:
        print(" ", c["docIds"], [t["term"] for t in c["terms"][:5]])
    print("  warnings:", r["warnings"])
    print("  payload bytes:", len(json.dumps(r, ensure_ascii=False)))


if __name__ == "__main__":
    main()
