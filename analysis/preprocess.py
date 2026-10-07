"""한국어 전처리: Kiwi 형태소 분석 + 품사 거르기 + 불용어 제거.

학습자가 '원문 → 분석용 낱말'로 바뀌는 과정을 눈으로 확인할 수 있도록
각 단계의 결과(남은 낱말, 빠진 낱말)를 함께 돌려준다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

from kiwipiepy import Kiwi

# 학생에게 보여 줄 품사 묶음. Kiwi(세종 품사 체계) 태그로 거른다.
POS_PRESETS: dict[str, tuple[str, ...]] = {
    "nouns": ("NNG", "NNP"),  # 일반 명사, 고유 명사
    "nouns_verbs": ("NNG", "NNP", "VV", "VA"),  # + 동사, 형용사
    "content": ("NNG", "NNP", "NNB", "VV", "VA", "MAG", "SL", "SN", "XR"),
}

DEFAULT_STOPWORDS = [
    "것", "수", "등", "때", "년", "월", "일", "곳", "중", "이", "그", "저",
    "하다", "되다", "있다", "없다", "같다", "보다", "이다", "않다", "위하다",
    "통하다", "대하다", "따르다", "말하다", "가지다",
    "우리", "또한", "그리고", "하지만", "때문", "경우", "정도", "관련",
    "기자", "사진", "출처", "무단", "전재", "배포", "금지",
]


@lru_cache(maxsize=1)
def get_kiwi() -> Kiwi:
    return Kiwi()


@dataclass
class PreprocessOptions:
    pos: str = "nouns"  # POS_PRESETS 키
    stopwords: list[str] = field(default_factory=lambda: list(DEFAULT_STOPWORDS))
    min_length: int = 1  # 글자 수 기준 최소 길이
    use_lemma: bool = True  # 동사·형용사를 기본형(-다)으로


URL_RE = re.compile(r"https?://\S+")
MD_RE = re.compile(r"[#*|>`_\[\]()]+")
SPACE_RE = re.compile(r"\s+")


def clean_text(text: str) -> str:
    text = URL_RE.sub(" ", text)
    text = MD_RE.sub(" ", text)  # markitdown 결과의 표·머리표 기호 정리
    return SPACE_RE.sub(" ", text).strip()


def _top(d: dict[str, int], n: int = 20) -> list[dict]:
    return [{"word": w, "count": c} for w, c in sorted(d.items(), key=lambda x: -x[1])[:n]]


def tokenize(text: str, opts: PreprocessOptions) -> dict:
    """한 문서를 분석용 낱말 목록으로 바꾸고 단계별로 무엇이 빠졌는지 기록한다."""
    kiwi = get_kiwi()
    allowed = POS_PRESETS.get(opts.pos, POS_PRESETS["nouns"])
    stop = set(opts.stopwords)

    tokens = kiwi.tokenize(clean_text(text))

    kept: list[str] = []
    removed_pos: dict[str, int] = {}
    removed_stop: dict[str, int] = {}
    removed_short: dict[str, int] = {}
    morphemes: list[dict] = []

    for t in tokens:
        tag = t.tag.split("-")[0]  # VV-R 같은 불규칙 표시 제거
        form = t.form
        if opts.use_lemma and tag in ("VV", "VA"):
            form = form + "다"
        keep = True
        if tag not in allowed:
            removed_pos[form] = removed_pos.get(form, 0) + 1
            keep = False
        elif form in stop:
            removed_stop[form] = removed_stop.get(form, 0) + 1
            keep = False
        elif len(form) < opts.min_length:
            removed_short[form] = removed_short.get(form, 0) + 1
            keep = False
        if keep:
            kept.append(form)
        if len(morphemes) < 300:
            morphemes.append({"form": form, "tag": tag, "kept": keep})

    return {
        "tokens": kept,
        "morphemes": morphemes,
        "stats": {
            "chars": len(text),
            "morphemes": len(tokens),
            "kept": len(kept),
            "removedByPos": sum(removed_pos.values()),
            "removedByStopword": sum(removed_stop.values()),
            "removedByLength": sum(removed_short.values()),
        },
        "removed": {
            "pos": _top(removed_pos),
            "stopword": _top(removed_stop),
            "length": _top(removed_short),
        },
    }
