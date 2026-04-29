#!/usr/bin/env bash
# Smoke-test local stack after: docker compose -f docker-compose.local.yml up -d

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

test_http() {
  local name=$1
  local url=$2
  echo -n "Testing $name... "
  if curl -sf "$url" >/dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
    ((PASSED++)) || true
  else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++)) || true
  fi
}

echo "Health checks (docker-compose.local.yml)"
echo "----------------------------------------"

test_http "API gateway" "http://localhost:3333/health"
test_http "Auth service" "http://localhost:3334/health"
test_http "Payment service" "http://localhost:3003/health"

echo -n "MongoDB (port 27017)... "
if command -v nc >/dev/null 2>&1 && nc -z localhost 27017 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
  ((PASSED++)) || true
else
  echo -e "${RED}FAIL (install nc or start MongoDB)${NC}"
  ((FAILED++)) || true
fi

echo ""
echo "Passed: $PASSED  Failed: $FAILED"
[ "$FAILED" -eq 0 ] && exit 0 || exit 1
