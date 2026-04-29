#!/bin/bash
# quick-start.sh — local backend via Docker + optional frontend

set -e

echo "Rural services — quick start"
echo ""

if ! command -v docker &> /dev/null; then
  echo "Docker is required. https://docs.docker.com/get-docker/"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Starting MongoDB, api-gateway, auth-service, payment-service (docker-compose.local.yml)..."
docker compose -f docker-compose.local.yml up -d --build

echo ""
echo "Backend:"
echo "  API gateway      http://localhost:3333/health"
echo "  Auth             http://localhost:3334/health"
echo "  Payment          http://localhost:3003/health"
echo ""
echo "Frontend (from repo root):"
echo "  cd frontend/app && npm install && npm run dev"
echo ""
