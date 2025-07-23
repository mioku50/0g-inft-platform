#!/bin/bash
set -e
BASE_URL=${BASE_URL:-http://localhost:3000}
DATA_FILE=$(mktemp /tmp/data-XXXX.jsonl)
echo '{"prompt":"hi","completion":"there"}' > "$DATA_FILE"

upload=$(curl -sf -F file=@"$DATA_FILE" "$BASE_URL/api/storage/upload-dataset")
root=$(echo "$upload" | jq -r '.rootHash')

resp=$(curl -sf -X POST "$BASE_URL/api/compute/fine-tune" \
  -H 'Content-Type: application/json' \
  -d "{\"agentId\":\"test\",\"datasetRoot\":\"$root\",\"baseModel\":\"llama\",\"steps\":1,\"learningRate\":0.1}")

taskId=$(echo "$resp" | jq -r '.taskId')

for i in {1..30}; do
  status=$(curl -sf "$BASE_URL/api/compute/fine-tune?taskId=$taskId")
  progress=$(echo "$status" | jq -r '.progress')
  [ "$progress" = "FAILED" ] && exit 1
  [ "$progress" = "Finished" ] && break
  sleep 30
done

ack=$(curl -sf -X POST "$BASE_URL/api/compute/acknowledge-model" \
  -H 'Content-Type: application/json' \
  -d "{\"taskId\":\"$taskId\"}")
path=$(echo "$ack" | jq -r '.path')

if [ -f "$path" ] && [ -s "$path" ]; then
  echo "model downloaded: $path"
  exit 0
fi
exit 1
