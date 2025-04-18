# syntax=docker/dockerfile:1

############################
# 1. Build stage
############################
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy and install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

############################
# 2. Final image
############################
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy your code
COPY backend/ ./backend
COPY frontend/ ./frontend

# Document the port (Cloud Run will set PORT=8080)
EXPOSE 8080

# Use the PORT env var if set, defaulting to 8080
CMD ["sh","-c","uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]