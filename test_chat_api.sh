# Тестирование 0G Compute Chat API

## 1. Проверка ENV переменных
echo "RPC_URL: $NEXT_PUBLIC_0G_RPC_URL"
echo "PRIVATE_KEY: ${OG_COMPUTE_PRIVATE_KEY:0:10}..."

## 2. Type-check и build
pnpm type-check
pnpm build

## 3. Запуск dev сервера для тестирования
pnpm dev &
sleep 5

## 4. Тестовый запрос
curl -X POST http://localhost:3000/api/compute/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hi","agentMetadata":{"name":"TestAgent","description":"Agent desc"}}'

echo ""
echo "Ожидаемый результат: JSON с success:true, isRealAI:true|false, metadata.timing"
