#!/bin/bash
set -e

: "${RPC:?}" > /dev/null
: "${NEXT_PUBLIC_0G_RPC_URL:?}" > /dev/null
: "${NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS:?}" > /dev/null
: "${NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT:?}" > /dev/null
: "${NEXT_PUBLIC_FINE_TUNE_PROVIDER:?}" > /dev/null

RPC_URL="$NEXT_PUBLIC_0G_RPC_URL"
SERVING="$NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS"
LEDGER="$NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT"

check_code() {
  local addr="$1"
  local code
  code=$(curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["'$addr'","latest"]}' "$RPC_URL" | jq -r '.result // empty')
  if [ -z "$code" ] || [ "$code" = "0x" ]; then
    echo "Contract not deployed at $addr" >&2
    exit 1
  fi
}

check_code "$SERVING"
check_code "$LEDGER"

echo "Create account & deposit"
CREATE=$(curl -s -X POST http://localhost:3000/api/compute/account -H 'content-type: application/json' -d '{"amount":"0.01","action":"create"}')
echo "$CREATE" | jq '.'
TX_HASH=$(echo "$CREATE" | jq -r '.txHash')
TX_URL=$(echo "$CREATE" | jq -r '.txUrl // empty')
[ -n "$TX_URL" ] && echo "Tx URL: $TX_URL"

echo "Polling balance..."
for i in {1..10}; do
  BAL=$(curl -s http://localhost:3000/api/compute/account | jq -r '.balance // "0"')
  echo "Attempt $i balance: $BAL"
  python3 - <<EOF
import sys
sys.exit(0 if float("$BAL") > 0 else 1)
EOF
  if [ $? -eq 0 ]; then
    break
  fi
  sleep 6
done

echo "Final balance: $BAL"
echo "txHash: $TX_HASH"
[ -n "$TX_URL" ] && echo "txUrl: $TX_URL"
