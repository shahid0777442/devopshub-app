#!/usr/bin/env bash
# Usage: scripts/smoke-test.sh <base_url> [expected_env]
# Deploy ke baad check karta hai ke app zinda hai, sahi environment mein hai aur metrics de rahi hai.
set -euo pipefail

BASE_URL="${1:?Usage: smoke-test.sh <base_url> [expected_env]}"
EXPECTED_ENV="${2:-}"
body=""

echo "Smoke test: $BASE_URL"

for i in $(seq 1 15); do
  if body=$(curl -fsS -m 5 "$BASE_URL/health" 2>/dev/null); then
    break
  fi
  echo "  app abhi ready nahi ($i/15), 4s wait..."
  sleep 4
  if [ "$i" -eq 15 ]; then
    echo "FAIL: /health respond nahi kar raha"
    exit 1
  fi
done

echo "  /health -> $body"

if [ -n "$EXPECTED_ENV" ] && ! echo "$body" | grep -q "\"env\":\"$EXPECTED_ENV\""; then
  echo "FAIL: expected env '$EXPECTED_ENV' nahi mila"
  exit 1
fi

curl -fsS -m 5 "$BASE_URL/metrics" | grep -q "devopshub_http_requests_total" \
  || { echo "FAIL: /metrics theek nahi"; exit 1; }

curl -fsS -m 5 "$BASE_URL/api/tasks" > /dev/null \
  || { echo "FAIL: /api/tasks theek nahi"; exit 1; }

echo "PASS: smoke test OK"
