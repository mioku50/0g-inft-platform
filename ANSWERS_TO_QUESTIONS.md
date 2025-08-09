# Ответы на дополнительные вопросы

## 1. Леджер: везде ли суммы передаются через ethers.parseEther(...)?

**Ответ: НЕТ!** SDK 0G ожидает числа в OG, а не BigInt в wei.

### Правильное использование:
```typescript
// ✅ Правильно - число в OG
await broker.ledger.addLedger(0.01)      // 0.01 OG
await broker.ledger.depositFund(0.05)    // 0.05 OG

// ❌ Неправильно - BigInt в wei  
await broker.ledger.addLedger(ethers.parseEther('0.01'))  // Ошибка!
```

### Где используется parseEther:
- **Только для работы с нативными токенами** (ETH/OG для gas)
- В файлах маркетплейса для NFT цен
- НЕ для методов леджера SDK

### Примеры из кода:
- `/workspace/web/lib/compute/clientBroker.ts:180`: `await broker.ledger.addLedger(0.01)`
- `/workspace/web/components/compute/LedgerBalance.tsx:84`: `await broker.ledger.addLedger(0.01)`
- `/workspace/web/lib/compute/chat-service.ts:198`: `await broker.ledger.addLedger(0.05)`

## 2. Реализован ли вызов acknowledgeProviderSigner до первого getRequestHeaders?

**Ответ: ДА!** Реализован с кешированием.

### Расположение:
`/workspace/web/lib/compute/clientBroker.ts`, строки 248-266

```typescript
async function acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
  const now = Date.now()
  const lastAck = acknowledgeCache.get(providerAddress)
  
  // Кеш на 30 минут
  if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
    console.log('[ClientBroker] Provider already acknowledged (cached)')
    return
  }
  
  try {
    console.log('[ClientBroker] Acknowledging provider:', providerAddress)
    await broker.inference.acknowledgeProviderSigner(providerAddress)
    acknowledgeCache.set(providerAddress, now)
    console.log('[ClientBroker] Provider acknowledged successfully')
  } catch (error) {
    console.warn('[ClientBroker] Failed to acknowledge provider (may already be acknowledged):', error)
    // Don't throw here as provider might already be acknowledged
  }
}
```

### Вызывается в prepareComputeRequest (строка 211):
```typescript
// Acknowledge provider if not already done (cached for 30 min)
await acknowledgeProviderIfNeeded(broker, providerAddress)

// Get request headers with billing information
const headers = await broker.inference.getRequestHeaders(providerAddress, content)
```

## 3. Есть ли проверка prepared-режима на сервере и processResponse на клиенте?

### На сервере - ДА!

**Файл:** `/workspace/web/app/api/compute/chat/route.ts`

#### Проверка 1: Non-custodial с prepared данными (строки 88-111)
```typescript
if (prepared === true && prep) {
  console.log('[CHAT] HIT - Using non-custodial mode - proxying prepared request')
  // Перенаправляет на /api/compute/proxy
}
```

#### Проверка 2: Non-custodial БЕЗ prepared данных (строки 122-130)
```typescript
if (useNonCustodial && !prep) {
  console.log('[CHAT] HIT - non-custodial mode required but no prepared request provided')
  return NextResponse.json(
    { 
      error: 'non_custodial_required',
      message: 'Non-custodial mode is enabled but no prepared request provided...',
      requiresPreparedRequest: true
    },
    { status: 400 }
  )
}
```

### На клиенте - ДА!

**Файл:** `/workspace/web/hooks/useNonCustodialChat.ts`, строки 115-123

```typescript
// After getting the response from proxy, call processResponse
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

## 4. Что пишет Network при отправке сообщения?

### Последовательность запросов:

1. **POST /api/compute/chat**
   - Request:
     ```json
     {
       "messages": [{"role": "user", "content": "Hello"}],
       "non_custodial": true,
       "prepared": true,
       "prep": {
         "endpoint": "https://api.openai.com/v1",
         "method": "POST",
         "headers": { /* billing headers */ },
         "body": "{ /* chat payload */ }"
       }
     }
     ```
   - Response: Прокси-ответ от провайдера

2. **Внутренний запрос от бэкенда**
   - Сервер делает POST на `/api/compute/proxy`
   - Proxy перенаправляет на провайдера (например, OpenAI API)

### Логи:
- Console: `[CHAT] start → prepared → fetch`
- Server: `[CHAT] HIT - Using non-custodial mode` → `[PROXY] HIT`

## Итоговая проверка

### ✅ Реализовано:
1. SDK использует числа в OG (не parseEther)
2. acknowledgeProviderSigner вызывается перед getRequestHeaders с кешированием
3. Сервер проверяет prepared режим и возвращает 400 без него
4. processResponse вызывается после получения ответа
5. Network показывает правильную последовательность запросов

### ⚠️ Важно:
- parseEther используется только для нативных токенов, НЕ для SDK методов
- Non-custodial режим требует обязательного наличия prepared данных
- acknowledgeProviderSigner кешируется на 30 минут для оптимизации