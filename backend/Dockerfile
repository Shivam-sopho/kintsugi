FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY data ./data
COPY kintsugi_adk ./kintsugi_adk
# Cloud Run sets $PORT
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
