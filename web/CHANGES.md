# Исправления ENV переменных и ENS ошибок

## Проблемы которые были исправлены:

1. **"Warning: Missing env … using fallback"** - система использовала fallback значения
2. **"network does not support ENS"** - провайдер создавался без явного network/chainId
3. **"invalid BigNumberish"** - небезопасная работа с ledger

## Изменения:

### 1. Разделение переменных на server/client

**Файл: `web/.env.local`** (создан)
```env
# Server-only переменные (без NEXT_PUBLIC_)
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_COMPUTE_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
COMPUTE_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
COMPUTE_INFERENCE_CONTRACT=0x5299bd255B76305ae08d7F95B270A485c6b95D54
FINE_TUNING_SERVING_ADDRESS=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
FINE_TUNE_PROVIDER=0xf07240Efa67755B5311bc75784a061eDB47165Dd

# Client-side переменные (с NEXT_PUBLIC_)
NEXT_PUBLIC_CHAIN_ID=16601
NEXT_PUBLIC_CHAIN_NAME=0G Testnet
NEXT_PUBLIC_NATIVE_SYMBOL=OG
```

### 2. Обновлен server/compute-env.ts

- Убрал использование `requireEnv` из `lib/constants.ts`
- Переменные читаются напрямую из `process.env` без `NEXT_PUBLIC_` префикса
- Добавлена функция `getEnvOrThrow` для обязательных переменных
- Провайдер создается с явным `Network` для избежания ENS ошибок

### 3. Исправлен broker.ts

- Провайдер создается с явным `JsonRpcProvider` и `Network('0g-testnet', 16601)`
- Broker создается с явными адресами контрактов:
  ```ts
  broker = createZGComputeNetworkBroker({
    signer: wallet,
    ledgerAddress: COMPUTE_LEDGER_CONTRACT,
    inferenceAddress: COMPUTE_INFERENCE_CONTRACT,
    fineTuningAddress: FINE_TUNING_SERVING
  })
  ```
- Упрощены `ledgerSafe` методы с безопасной обработкой BigNumberish

### 4. Обновлен chat-service.ts

- Использует новый `getBroker()` из `broker.ts`
- Упрощена логика acknowledge и запросов к провайдерам
- Исправлены типы для TypeScript

### 5. Убраны fallback значения

**Файл: `web/lib/constants.ts`**
- Удалены fallback значения из `requireEnv`
- Теперь функция просто выбрасывает ошибку если переменная не найдена

### 6. Добавлен "доктор" для проверки ENV

**Файл: `web/scripts/compute-doctor.ts`** (создан)
- Проверяет все обязательные ENV переменные
- Тестирует RPC подключение с правильным chainId
- Валидирует wallet setup

**Файл: `web/package.json`**
- Добавлена команда: `"compute:doctor": "tsx scripts/compute-doctor.ts"`

## Как проверить:

1. **Проверить ENV переменные:**
   ```bash
   cd web
   pnpm compute:doctor
   ```

2. **Type-check и build:**
   ```bash
   pnpm type-check
   pnpm build
   ```

3. **Тестировать API:**
   ```bash
   pnpm dev
   # В другом терминале:
   curl -X POST http://localhost:3000/api/compute/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"hi","agentMetadata":{"name":"TestAgent","description":"Agent desc"}}'
   ```

## Ожидаемый результат:

- ✅ Нет варнингов "Missing env … using fallback"
- ✅ Нет ошибки "network does not support ENS"  
- ✅ Broker инициализируется с правильными контрактами
- ✅ POST /api/compute/chat возвращает реальный ответ от провайдеров
- ✅ В логах видно кэширование брокера
- ✅ Type-check и build проходят

## Файлы изменены:

- `web/.env.local` (создан)
- `web/lib/server/compute-env.ts` (переписан)
- `web/lib/compute/broker.ts` (исправлен)
- `web/lib/compute/chat-service.ts` (обновлен)
- `web/lib/constants.ts` (упрощен)
- `web/scripts/compute-doctor.ts` (создан)
- `web/package.json` (добавлена команда)
- `web/test-env-doctor.js` (создан для простой проверки)