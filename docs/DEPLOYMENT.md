# Deployment Guide

Instructions for deploying the MCP-based Meme Engine in various environments.

## Table of Contents

- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Considerations](#production-considerations)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- ffmpeg (latest)
- ComfyUI Cloud API key

### Setup Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd meme-engine

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# or: venv\Scripts\activate  # Windows

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install MCP servers
cd mcp-servers/comfyui-server && npm install && npm run build
cd ../assembly-server && npm install && npm run build
cd ../meme-engine-server && npm install && npm run build

# 5. Configure environment
cp .env.example .env
# Edit .env with your settings

# 6. Run test
cd ../..
python -m meme_engine test
```

### Development Workflow

```bash
# Terminal 1: Run MCP servers (for debugging)
cd mcp-servers/comfyui-server
npm run dev  # Watch mode

# Terminal 2: Run web UI
cd web
npm run dev

# Terminal 3: Your commands
python scripts/generate-meme.py --concept "test"
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build for Meme Engine

# Stage 1: Python base
FROM python:3.11-slim as python-base

RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/python/ ./src/python/

# Stage 2: Node.js base
FROM node:20-slim as node-base

WORKDIR /app

# Copy and build MCP servers
COPY mcp-servers/ ./mcp-servers/

RUN cd mcp-servers/comfyui-server && npm ci && npm run build
RUN cd mcp-servers/assembly-server && npm ci && npm run build
RUN cd mcp-servers/meme-engine-server && npm ci && npm run build

# Stage 3: Web UI
FROM node:20-slim as web-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# Stage 4: Production
FROM python:3.11-slim as production

RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python
COPY --from=python-base /app/src/python/ ./src/python/
COPY --from=python-base /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/

# Copy Node.js/MCP servers
COPY --from=node-base /app/mcp-servers/ ./mcp-servers/

# Copy Web UI
COPY --from=web-builder /app/web/.next/ ./web/.next/
COPY --from=web-builder /app/web/package*.json ./web/
COPY --from=web-builder /app/web/node_modules/ ./web/node_modules/

# Copy configuration
COPY .env.example ./.env
COPY scripts/ ./scripts/

# Create output directory
RUN mkdir -p output

EXPOSE 3000

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

CMD ["./scripts/start-production.sh"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  meme-engine:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - COMFY_CLOUD_API_KEY=${COMFY_CLOUD_API_KEY}
      - OUTPUT_DIR=/app/output
      - LOG_LEVEL=INFO
    volumes:
      - ./output:/app/output
      - ./.env:/app/.env:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Docker Commands

```bash
# Build
docker-compose build

# Run
docker-compose up -d

# View logs
docker-compose logs -f meme-engine

# Stop
docker-compose down

# Update
docker-compose pull
docker-compose up -d
```

---

## Production Considerations

### Security

#### API Key Management

```bash
# Use Docker secrets or environment variables
# Never commit .env files

# Option 1: Docker secrets
echo "your-api-key" | docker secret create comfy_api_key -

# Option 2: Environment file (restricted permissions)
touch .env.production
chmod 600 .env.production
```

#### Network Security

```yaml
# docker-compose.production.yml
services:
  meme-engine:
    networks:
      - meme-engine-network
    # Don't expose ports directly in production
    # Use reverse proxy instead
    expose:
      - "3000"
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - meme-engine-network
    depends_on:
      - meme-engine

networks:
  meme-engine-network:
    driver: bridge
```

### Performance

#### Resource Limits

```yaml
# docker-compose.production.yml
services:
  meme-engine:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

#### Caching

```python
# Add caching to expensive operations
import functools
import redis

redis_client = redis.Redis(host='redis', port=6379, db=0)

def cache_workflow(ttl=3600):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            key = f"workflow:{func.__name__}:{hash(str(args))}"
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
            result = func(*args, **kwargs)
            redis_client.setex(key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator
```

### Scalability

#### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  meme-engine:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    
  nginx:
    # Load balancer
    volumes:
      - ./nginx-upstream.conf:/etc/nginx/conf.d/default.conf
```

nginx-upstream.conf:
```nginx
upstream meme_engine {
    least_conn;
    server meme-engine_1:3000;
    server meme-engine_2:3000;
    server meme-engine_3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://meme_engine;
    }
}
```

---

## Environment-Specific Configuration

### Development

```bash
# .env.development
LOG_LEVEL=DEBUG
OUTPUT_DIR=./output/dev
MCP_DEBUG=true
ENABLE_MOCKS=true
```

### Staging

```bash
# .env.staging
LOG_LEVEL=INFO
OUTPUT_DIR=./output/staging
COMFY_CLOUD_API_KEY=staging-key
RATE_LIMIT=100/hour
```

### Production

```bash
# .env.production
LOG_LEVEL=WARNING
OUTPUT_DIR=./output/prod
COMFY_CLOUD_API_KEY=prod-key
RATE_LIMIT=1000/hour
SENTRY_DSN=https://...
```

### Configuration Loader

```python
# config.py
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    env: str
    log_level: str
    output_dir: str
    comfy_api_key: str
    rate_limit: int
    sentry_dsn: Optional[str]
    
    @classmethod
    def from_env(cls):
        env = os.getenv("APP_ENV", "development")
        return cls(
            env=env,
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            output_dir=os.getenv("OUTPUT_DIR", "./output"),
            comfy_api_key=os.getenv("COMFY_CLOUD_API_KEY"),
            rate_limit=int(os.getenv("RATE_LIMIT", "100")),
            sentry_dsn=os.getenv("SENTRY_DSN")
        )
```

---

## Monitoring and Logging

### Structured Logging

```python
# logging_config.py
import logging
import json
from pythonjsonlogger import jsonlogger

def setup_logging(log_level="INFO"):
    logHandler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s'
    )
    logHandler.setFormatter(formatter)
    
    logger = logging.getLogger()
    logger.addHandler(logHandler)
    logger.setLevel(log_level)
    
    return logger
```

### Health Checks

```python
# health.py
import asyncio
from fastapi import FastAPI, Response

app = FastAPI()

@app.get("/api/health")
async def health_check():
    checks = {
        "python_modules": check_python_modules(),
        "mcp_servers": await check_mcp_servers(),
        "comfyui_api": await check_comfyui_api(),
        "disk_space": check_disk_space()
    }
    
    all_healthy = all(c["healthy"] for c in checks.values())
    
    return Response(
        content=json.dumps({"status": "healthy" if all_healthy else "unhealthy", "checks": checks}),
        media_type="application/json",
        status_code=200 if all_healthy else 503
    )
```

### Metrics

```python
# metrics.py
from prometheus_client import Counter, Histogram, start_http_server

# Counters
generations_total = Counter(
    'meme_generations_total',
    'Total meme generations',
    ['format', 'status']
)

# Histograms
generation_duration = Histogram(
    'meme_generation_duration_seconds',
    'Time spent generating memes',
    ['stage']
)

# Usage
with generation_duration.labels(stage="image_gen").time():
    await generate_image(...)
    
generations_total.labels(format="mini-drama", status="success").inc()
```

### Alerting Rules

```yaml
# alerting.yml
groups:
  - name: meme-engine
    rules:
      - alert: HighErrorRate
        expr: rate(meme_generations_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in meme generation"
          
      - alert: DiskSpaceLow
        expr: disk_free_percent < 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Disk space critically low"
```

---

## Backup and Recovery

### What to Backup

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/meme-engine/$DATE"

mkdir -p "$BACKUP_DIR"

# 1. Configuration
cp .env "$BACKUP_DIR/"
cp -r mcp-servers/*/config.json "$BACKUP_DIR/" 2>/dev/null || true

# 2. Generated content (optional - can be large)
# tar czf "$BACKUP_DIR/output.tar.gz" output/

# 3. Database (if using one)
# pg_dump ... > "$BACKUP_DIR/database.sql"

# 4. Create manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "date": "$DATE",
  "version": "$(git describe --tags)",
  "files": ["env", "config", "output"]
}
EOF

echo "Backup created: $BACKUP_DIR"
```

### Automated Backups

```yaml
# docker-compose.backup.yml
services:
  backup:
    image: offen/docker-volume-backup:latest
    volumes:
      - ./output:/backup/output:ro
      - ./backups:/archive
      - ./scripts/backup.sh:/backup/backup.sh:ro
    environment:
      BACKUP_CRON_EXPRESSION: "0 2 * * *"
      BACKUP_RETENTION_DAYS: "30"
```

### Recovery

```bash
#!/bin/bash
# restore.sh

BACKUP_DIR=$1

echo "Restoring from $BACKUP_DIR..."

# 1. Restore configuration
cp "$BACKUP_DIR/.env" ./

# 2. Restore output (optional)
# tar xzf "$BACKUP_DIR/output.tar.gz"

# 3. Verify
docker-compose config
docker-compose ps

echo "Restore complete. Start with: docker-compose up -d"
```

---

## Cloud Deployment

### AWS ECS

```json
{
  "family": "meme-engine",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "meme-engine",
      "image": "your-registry/meme-engine:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "LOG_LEVEL",
          "value": "INFO"
        }
      ],
      "secrets": [
        {
          "name": "COMFY_CLOUD_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:..."
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/meme-engine",
          "awslogs-region": "us-east-1"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096"
}
```

### Google Cloud Run

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/meme-engine:$SHORT_SHA', '.']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/meme-engine:$SHORT_SHA']
  
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'meme-engine'
      - '--image'
      - 'gcr.io/$PROJECT_ID/meme-engine:$SHORT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
```

### Kubernetes

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meme-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: meme-engine
  template:
    metadata:
      labels:
        app: meme-engine
    spec:
      containers:
        - name: meme-engine
          image: meme-engine:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: meme-engine-secrets
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Run Python tests
        run: |
          pip install pytest pytest-asyncio
          pytest tests/python/ -m unit
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Run TypeScript tests
        run: |
          cd tests/typescript
          npm ci
          npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t meme-engine:${{ github.sha }} .
          docker tag meme-engine:${{ github.sha }} meme-engine:latest
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push meme-engine:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
            "cd /opt/meme-engine && docker-compose pull && docker-compose up -d"
```

---

For more information, see:
- [README.md](./README.md) - Quick start guide
- [API.md](./API.md) - API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture decisions
