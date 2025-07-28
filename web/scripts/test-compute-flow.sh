#!/usr/bin/env bash
# Simple Compute Network E2E test
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${YELLOW}-- $*${NC}"; }
pass() { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; }

REQUIRED=(OG_RPC_URL FINE_TUNING_SERVING_ADDRESS FINE_TUNE_PROVIDER OG_COMPUTE_PRIVATE_KEY)
missing=()
for v in "${REQUIRED[@]}"; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if (( ${#missing[@]} )); then
  fail "Missing env vars: ${missing[*]}"
  exit 1
fi
pass "Env vars present"

node -e "const {ethers}=require('ethers');(async()=>{try{const p=new ethers.JsonRpcProvider(process.env.OG_RPC_URL);await p.getBlockNumber();console.log('ok')}catch(e){console.error(e.message);process.exit(1)}})()" && pass "RPC reachable"

BASE="http://localhost:3000"

log "GET /api/compute/account"
curl -sf "$BASE/api/compute/account" | jq '.' || true

log "Create account"
RES=$(curl -sf -X POST "$BASE/api/compute/account" -H 'content-type: application/json' -d '{"amount":"0.001","action":"create"}') || { fail "Account request failed"; exit 1; }
echo "$RES" | jq '.'

TASK=$(curl -sf -X POST "$BASE/api/compute/fine-tune" -H 'content-type: application/json' -d '{"agentId":"test","datasetRootHash":"0x","baseModel":"llama-3.3-70b","steps":1,"learningRate":0.0001}' | jq -r '.taskId // empty') || true
if [ -n "$TASK" ]; then
  pass "Fine-tune task created: $TASK"
  curl -sf "$BASE/api/compute/fine-tune?taskId=$TASK" | jq '.' || true
else
  log "Task not created"
fi

log "Type check"
pnpm --dir web type-check

log "Build"
pnpm --dir web build >/dev/null
pass "Build succeeded"
