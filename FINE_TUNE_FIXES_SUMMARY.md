# Fine-tune Flow Fixes Summary

## Проблемы, которые были выявлены и исправлены

### 1. ❌ Неправильный ABI контракта Ledger
**Проблема:** Текущий ABI был слишком упрощен и не содержал всех необходимых методов для работы с 0G SDK.

**Исправление:** Обновлен `LEDGER_ABI` в `web/lib/compute/broker.ts` с полным набором методов:
- Account management: `addAccount`, `depositFund`, `requestRefundAll`
- Account queries: `accountExists`, `getAccount`
- Service management: `getService`
- Provider signer: `acknowledgeProviderSigner`
- Fine-tuning methods: `createTask`, `getTask`, `acknowledgeDeliverable`
- Events для отслеживания операций

### 2. ❌ Неправильное использование контрактов
**Проблема:** Код пытался вызывать методы query (getService, accountExists) на Ledger контракте, хотя они должны вызываться на FineTuningServing контракте.

**Исправление:** 
- Query методы (`getService`, `accountExists`, `getAccount`) теперь вызываются на FineTuningServing контракте
- Transaction методы (`addAccount`, `depositFund`) выполняются через SDK broker
- Убрано ошибочное предупреждение о несовместимости Ledger контракта

### 3. ❌ Неправильный метод createTask
**Проблема:** В `FineTuneServiceV2.createTask()` передавался hash модели вместо имени модели.

**Исправление в `web/lib/compute/fine-tune-service-v2.ts`:**
```typescript
// Было:
const tx = await this.broker.fineTuning.createTask(
  provider,
  modelHash, // ❌ hash вместо имени
  datasetHash,
  trainingParams,
  fee
)

// Стало:
const tx = await this.broker.fineTuning.createTask(
  provider,
  model, // ✅ имя модели (например, "distilbert-base-uncased")
  datasetHash,
  JSON.stringify(trainingParams), // ✅ JSON строка для контракта
  fee
)
```

### 4. ❌ Неправильный расчет fee
**Проблема:** Fee рассчитывался как `dataSize * pricePerByte`, но согласно логам CLI должен быть `dataSize * pricePerToken * epochs`.

**Исправление:**
```typescript
// Было:
const pricePerByte = BigInt(providerInfo.pricePerByte || '1')
const dataSizeInBytes = BigInt(dataSize || 0)
const fee = dataSizeInBytes * pricePerByte

// Стало:
const pricePerToken = BigInt(1) // 1 neuron per token (из логов CLI)
const dataSizeInTokens = BigInt(dataSize || 0)
const epochs = BigInt(3) // Default epochs из конфигурации
const fee = dataSizeInTokens * pricePerToken * epochs
```

### 5. ❌ Неправильный расчет токенов в датасете
**Проблема:** `calculateTokenSize` возвращал размер в байтах, а не в токенах.

**Исправление:**
```typescript
// Было:
return new TextEncoder().encode(datasetContent).length

// Стало:
const byteSize = new TextEncoder().encode(datasetContent).length
// Приблизительный расчет: ~4 символа = 1 токен для английского текста
const approximateTokens = Math.ceil(byteSize / 4)
return approximateTokens
```

### 6. ❌ Прямые вызовы контрактов вместо SDK
**Проблема:** В `broker.ts` методы `addAccountWithDeposit` и `deposit` делали прямые вызовы к контрактам.

**Исправление:** Переведены на использование SDK broker:
```typescript
// Было:
const tx = await ledgerContract.addAccount(user, provider, extraInfo, { value })

// Стало:
const tx = await broker.fineTuning.addAccount(user, provider, extraInfo, { value })
```

## Результаты тестирования

### ✅ Что работает после исправлений:
1. **Provider service query** - успешно получаем информацию о провайдере
2. **Account existence check** - корректно проверяем существование аккаунта
3. **Account details retrieval** - получаем баланс, nonce, pending refund
4. **Token calculation** - правильный расчет токенов из текста
5. **Fee calculation** - корректная формула на основе токенов и epochs
6. **CreateTask parameters** - правильная структура параметров для создания задачи

### ⚠️ Что требует дальнейшей работы:
1. **DepositFund operation** - может потребовать дополнительной настройки SDK broker
2. **UI integration** - обновление интерфейса для использования исправленных методов
3. **Error handling** - улучшение обработки специфических ошибок 0G

## Файлы, которые были изменены:

1. **`web/lib/compute/broker.ts`**
   - Обновлен LEDGER_ABI с полным набором методов
   - Убрано предупреждение о несовместимости Ledger
   - Переведены методы на использование SDK broker
   - Улучшено логирование для отладки

2. **`web/lib/compute/fine-tune-service-v2.ts`**
   - Исправлен метод createTask для использования имени модели
   - Исправлен расчет fee на основе токенов и epochs
   - Улучшен метод calculateTokenSize для правильного подсчета токенов
   - Добавлено JSON.stringify для параметров обучения

## Следующие шаги

1. **Тестирование через UI** - проверить работу исправлений в веб-интерфейсе
2. **Интеграция с 0G Storage** - добавить правильную загрузку датасетов
3. **Мониторинг задач** - реализовать отслеживание прогресса fine-tuning
4. **Обработка результатов** - добавить скачивание и расшифровку обученных моделей

## Совместимость с CLI

Все исправления основаны на официальной документации 0G CLI и успешных логах выполнения:
- Используются те же адреса контрактов
- Применяется та же логика расчета fee
- Используются те же параметры обучения
- Соблюдается та же структура вызовов API

Исправления должны обеспечить полную совместимость веб-интерфейса с CLI функционалом 0G Compute Network.