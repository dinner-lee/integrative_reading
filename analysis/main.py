"""텍스트 마이닝 분석 서버 (FastAPI).

Next.js 서버만 호출하도록 ANALYSIS_SECRET 헤더로 보호한다.
실행: uvicorn main:app --port 8000
"""

from __future__ import annotations

import io
import os
import tempfile

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from mining import METHODS, Doc, MiningOptions, bertopic_available
from preprocess import DEFAULT_STOPWORDS, POS_PRESETS, PreprocessOptions, tokenize

app = FastAPI(title="integrative-writing-lab analysis")

SECRET = os.environ.get("ANALYSIS_SECRET", "")
MAX_PDF_BYTES = 20 * 1024 * 1024


def check_secret(x_analysis_secret: str = Header(default="")):
    if SECRET and x_analysis_secret != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


class DocIn(BaseModel):
    id: str
    title: str
    text: str


class PreprocessIn(BaseModel):
    pos: str = "nouns"
    stopwords: list[str] | None = None
    minLength: int = 1
    useLemma: bool = True

    def to_options(self) -> PreprocessOptions:
        return PreprocessOptions(
            pos=self.pos if self.pos in POS_PRESETS else "nouns",
            stopwords=self.stopwords if self.stopwords is not None else list(DEFAULT_STOPWORDS),
            min_length=max(1, self.minLength),
            use_lemma=self.useLemma,
        )


class MiningIn(BaseModel):
    k: int | None = Field(default=None, ge=1, le=12)
    minDf: int = Field(default=1, ge=1, le=20)
    maxDf: float = Field(default=1.0, gt=0, le=1.0)
    ngram: int = Field(default=1, ge=1, le=2)
    seed: int = 42


class AnalyzeIn(BaseModel):
    method: str
    docs: list[DocIn]
    preprocess: PreprocessIn = PreprocessIn()
    mining: MiningIn = MiningIn()


class PreviewIn(BaseModel):
    text: str
    preprocess: PreprocessIn = PreprocessIn()


@app.get("/health")
def health():
    return {"ok": True, "bertopic": bertopic_available()}


@app.get("/defaults", dependencies=[Depends(check_secret)])
def defaults():
    return {
        "stopwords": DEFAULT_STOPWORDS,
        "posPresets": {k: list(v) for k, v in POS_PRESETS.items()},
        "methods": [m for m in METHODS if m != "bertopic" or bertopic_available()],
    }


@app.post("/preprocess", dependencies=[Depends(check_secret)])
def preprocess(body: PreviewIn):
    return tokenize(body.text, body.preprocess.to_options())


@app.post("/analyze", dependencies=[Depends(check_secret)])
def analyze(body: AnalyzeIn):
    fn = METHODS.get(body.method)
    if fn is None:
        raise HTTPException(400, f"알 수 없는 방법: {body.method}")
    docs = [Doc(id=d.id, title=d.title, text=d.text) for d in body.docs if d.text.strip()]
    if len(docs) < 2:
        raise HTTPException(400, "내용이 있는 자료가 2개 이상 있어야 분석할 수 있어요.")
    m = body.mining
    opts = MiningOptions(k=m.k, min_df=m.minDf, max_df=m.maxDf, ngram=m.ngram, seed=m.seed)
    try:
        return fn(docs, body.preprocess.to_options(), opts)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(422, str(e))


@app.post("/extract", dependencies=[Depends(check_secret)])
async def extract(file: UploadFile = File(...)):
    """PDF 등 문서 파일을 markitdown으로 텍스트(마크다운)로 바꾼다."""
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "파일이 너무 커요(최대 20MB).")
    from markitdown import MarkItDown

    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            result = MarkItDown().convert(tmp.name)
        except Exception as e:  # markitdown은 형식별로 다양한 예외를 던진다
            raise HTTPException(422, f"텍스트로 바꾸지 못했어요: {e}")
    text = result.text_content or ""
    return {
        "text": text,
        "chars": len(text),
        "title": getattr(result, "title", None),
        "warning": None if text.strip() else "글자를 찾지 못했어요. 스캔한 이미지 PDF일 수 있어요.",
    }
