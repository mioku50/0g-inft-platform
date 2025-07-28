#!/bin/bash
set -e

: "${NEXT_PUBLIC_0G_RPC_URL:?}" > /dev/null
: "${NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS:?}" > /dev/null
: "${NEXT_PUBLIC_FINE_TUNE_PROVIDER:?}" > /dev/null
: "${OG_COMPUTE_PRIVATE_KEY:?}" > /dev/null

RPC="$NEXT_PUBLIC_0G_RPC_URL"
ADDR="$NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS"
CODE=$(curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["'$ADDR'","latest"]}' "$RPC" | jq -r '.result // empty')
if [ -z "$CODE" ] || [ "$CODE" = "0x" ]; then
  echo "Contract not deployed at $ADDR" >&2
  exit 1
fi

echo "Create account & deposit"
CREATE=$(curl -s -X POST http://localhost:3000/api/compute/account -H 'content-type: application/json' -d '{"amount":"0.01","action":"create"}')
echo "$CREATE" | jq '.'
TX_URL=$(echo "$CREATE" | jq -r '.txUrl // empty')
[ -n "$TX_URL" ] && echo "Tx: $TX_URL"

echo "Deposit again"
DEP=$(curl -s -X POST http://localhost:3000/api/compute/account -H 'content-type: application/json' -d '{"amount":"0.005","action":"deposit"}')
echo "$DEP" | jq '.'
TX_URL=$(echo "$DEP" | jq -r '.txUrl // empty')
[ -n "$TX_URL" ] && echo "Tx: $TX_URL"

sleep 2
BAL=$(curl -s http://localhost:3000/api/compute/account)
echo "$BAL" | jq '.'

exit 0
