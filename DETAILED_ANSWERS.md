# Подробные ответы на технические вопросы

## 1. Почему выбран путь @0glabs/0g-serving-broker/lib.esm/index.js?

### Анализ package.json пакета:
```json
"exports": {
  "types": "./types/index.d.ts",
  "require": "./lib.commonjs/index.js",
  "import": "./lib.esm/index.mjs"
},
"module": "./lib.esm/index.mjs"
```

### Проблема:
- При использовании `import('@0glabs/0g-serving-broker')` webpack/Next.js может выбрать CommonJS версию
- Это вызывает ошибку "exports is not defined" в браузере

### Решение:
- Явный путь `/lib.esm/index.js` гарантирует загрузку ESM версии
- **Стабильность**: Структура `lib.esm/` стабильна с версии 0.2.x, но лучше использовать `import('./lib.esm/index.mjs')` согласно exports

## 2. SSR-гарды и динамические импорты

### clientBroker.ts:
```typescript
// Строка 32-34: SSR guard в getClientBroker()
if (typeof window === 'undefined') {
  throw new Error('Client broker can only be used in browser environment')
}

// Строка 63: Динамический импорт
const brokerModule = await import('@0glabs/0g-serving-broker/lib.esm/index.js')

// Строки 95-97: SSR guard в isClientBrokerAvailable()
if (typeof window === 'undefined') {
  return false
}

// Строки 117-119: SSR guard в getCurrentWalletAddress()
if (typeof window === 'undefined') {
  return null
}
```

### LedgerBalance.tsx:
```typescript
// Строка 48: SSR guard в loadLedgerInfo()
if (typeof window === 'undefined') return

// Строка 104: SSR guard в topUpBalance()
if (!ledgerInfo || typeof window === 'undefined') return

// Строка 135: Рендер guard
if (!isClient) {
  return null
}
```

### При рендере на сервере:
- `getClientBroker()` выбросит ошибку "Client broker can only be used in browser environment"
- `isClientBrokerAvailable()` вернет `false`
- `getCurrentWalletAddress()` вернет `null`
- `LedgerBalance` компонент вернет `null` (не рендерится)

## 3. Happy-path Non-custodial

### Последовательность:
1. **Connect wallet** → MetaMask подключается
2. **Ledger check** → `broker.ledger.getBalance()` или auto-create с 0.01 OG
3. **Prepare request** → `prepareComputeRequest()` создает подписанные headers
4. **POST /api/compute/chat** с `prepared: true` и `prep` данными
5. **Сервер** проксирует на `/api/compute/proxy`
6. **Proxy** отправляет на провайдера (OpenAI)
7. **Response** → streaming ответ
8. **processResponse** → `broker.inference.processResponse(provider, content, id)`

### Логи:
```
[CHAT] start
[CHAT] prepared
[CHAT] fetch
[CHAT] HIT - Using non-custodial mode
[PROXY] HIT - POST /api/compute/proxy
[CHAT] processResponse called successfully
```

## 4. Смена аккаунта в кошельке

### Кеширование по адресу (clientBroker.ts, строки 54-71):
```typescript
const currentAddress = await signer.getAddress()

// Return cached broker if we have one for this address
const cachedBroker = brokerCache.get(currentAddress)
if (cachedBroker) {
  return cachedBroker
}

// ... создание нового брокера ...

// Cache the broker by address
brokerCache.set(currentAddress, broker)
```

**При смене аккаунта**:
- Новый адрес → новый брокер
- Старый брокер остается в кеше под старым адресом
- Каждый адрес имеет свой экземпляр брокера

## 5. Acknowledge Provider

### Расположение (clientBroker.ts, строки 248-266):
```typescript
const ACKNOWLEDGE_TTL = 30 * 60 * 1000 // 30 minutes (строка 14)

async function acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
  const now = Date.now()
  const lastAck = acknowledgeCache.get(providerAddress)
  
  if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
    console.log('[ClientBroker] Provider already acknowledged (cached)')
    return
  }
  
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress)
    acknowledgeCache.set(providerAddress, now)
  } catch (error) {
    console.warn('[ClientBroker] Failed to acknowledge provider (may already be acknowledged):', error)
  }
}
```

### Вызывается в prepareComputeRequest (строка 211):
```typescript
await acknowledgeProviderIfNeeded(broker, providerAddress)
```

## 6. processResponse

### Расположение (useNonCustodialChat.ts, строки 115-123):
```typescript
try {
  const broker = await getClientBroker()
  const completionId = responseData?.id || 'completion-' + Date.now()
  await broker.inference.processResponse(providerAddress, responseContent, completionId)
  console.log('[CHAT] processResponse called successfully')
} catch (processError: any) {
  console.warn('[CHAT] processResponse failed (non-critical):', processError.message)
  // Don't throw here as the chat response was successful
}
```

### При TEE-верификации false:
- Логируется warning, но чат продолжает работать
- Ответ все равно показывается пользователю
- Это non-critical ошибка

## 7. Леджер и единицы измерения

### OG vs Wei:
- **SDK методы**: числа в OG (`addLedger(0.01)`)
- **parseEther**: только для gas и нативных токенов
- **Конвертация**: происходит внутри SDK при вызове контрактов

### Исключения с parseEther:
```typescript
// wallet-client.ts, строка 42
if (balance && balance < ethers.parseEther('0.001')) {
  throw new Error('Insufficient gas balance')
}

// broker.ts, строка 376 (для gas)
const value = ethers.parseEther(amount)
```

## 8. Автосоздание леджера

### Триггер (LedgerBalance.tsx, строки 79-85):
```typescript
} catch (ledgerError: any) {
  console.log('[LedgerBalance] No existing ledger, will create one')
}

// Auto-create ledger if it doesn't exist
console.log('[LedgerBalance] Creating ledger with 0.01 OG')
await broker.ledger.addLedger(0.01)
```

### При недостатке средств:
- Показывается ошибка "Insufficient funds"
- Предлагается пополнить через кнопку "Top up"

## 9. API /api/compute/chat при !prepared

### Код (route.ts, строки 122-130):
```typescript
if (useNonCustodial && !prep) {
  console.log('[CHAT] HIT - non-custodial mode required but no prepared request provided')
  return NextResponse.json(
    { 
      error: 'non_custodial_required',
      message: 'Non-custodial mode is enabled but no prepared request provided. Please connect wallet and try again.',
      requiresPreparedRequest: true
    },
    { status: 400 }
  )
}
```

### Пример ответа:
```json
{
  "error": "non_custodial_required",
  "message": "Non-custodial mode is enabled but no prepared request provided. Please connect wallet and try again.",
  "requiresPreparedRequest": true
}
```

## 10. Логирование и маскировка

### Что логируем:
- Provider address
- Message length
- Mode (custodial/non-custodial)
- Success/error статусы

### Что НЕ логируем:
- Billing headers (X-Billing-*)
- Приватные ключи
- Полное содержимое сообщений

### Маскировка:
```typescript
// Пример маскировки адреса
const masked = `${address.slice(0, 6)}...${address.slice(-4)}`
```

## 11. /api/storage/retrieve сценарии

### a) Локальный JSON найден (строки 61-62):
```typescript
const localContent = await fs.readFile(localPath, 'utf-8')
return NextResponse.json({ success: true, content: localContent, rootHash: cleanRootHash, local: true })
```

### b) ENOENT фоллбэк (строки 64-70):
```typescript
if (fileError.code === 'ENOENT') {
  console.log('[Storage Retrieve] Local file not found, falling back to indexer')
} else {
  console.log('[Storage Retrieve] File access error:', fileError.message)
}
// continue to fallback
```

### Путь для чтения:
```typescript
const localDir = path.join(process.cwd(), 'data', 'metadata')
const localPath = path.join(localDir, `${cleanRootHash}.json`)
```

## 12. Совместимость и инфраструктура

### ChainID:
```typescript
// lib/constants.ts
export const CHAIN_ID = 16601
```

### Минимальные требования:
- Node.js 18+ (для native fetch)
- Next.js 13+ (App Router)
- Флаги: `--legacy-peer-deps` для npm install

## 13. Race conditions и дедупликация

### Текущая проблема:
- ❌ Нет защиты от двойных кликов в useNonCustodialChat
- ❌ Нет дедупликации запросов

### Рекомендация:
```typescript
const [isSending, setIsSending] = useState(false)

const sendMessage = async () => {
  if (isSending) return
  setIsSending(true)
  try {
    // ... отправка ...
  } finally {
    setIsSending(false)
  }
}
```

### "Headers already used":
- Каждый вызов `getRequestHeaders()` создает новые headers
- Повторное использование одних headers невозможно (одноразовые nonce)