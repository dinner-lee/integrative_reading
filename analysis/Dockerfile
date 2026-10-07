# 텍스트 마이닝 분석 서버 (Railway, Render, Fly.io, Cloud Run 등)
# BERTopic까지 쓰려면: docker build --build-arg EXTRAS=bertopic .
FROM python:3.12-slim

ARG EXTRAS=""
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt requirements-bertopic.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && if [ "$EXTRAS" = "bertopic" ]; then pip install --no-cache-dir -r requirements-bertopic.txt; fi

COPY *.py ./
# Kiwi 모델을 미리 불러 첫 요청 지연을 줄인다
RUN python -c "from kiwipiepy import Kiwi; Kiwi()"

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
