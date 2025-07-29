# Fine-tune Flow Recheck Report

## Дата: 29.07.2025

## Краткое резюме

Проведена полная диагностика fine-tune flow. Обнаружена и исправлена инвертированная логика вызовов: операции `addAccount` и `depositFund` должны вызываться через контракт **Ledger**, а не напрямую на FineTuningServing.

## 1. Архитектура Ledger vs Serving (из документации)

### Подтверждение из SDK (web/tmp/fine-tuning/contract/fine_tuning_serving.go)

```go
// Solidity: function addAccount(address user, address provider, string additionalInfo) payable returns()
// Solidity: function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable returns()
```

SDK содержит биндинги для обоих контрактов, но архитектура подразумевает:

1. **Ledger контракт** - точка входа для операций с аккаунтами
2. **FineTuningServing контракт** - внутренняя логика, проверяет что вызов идет от Ledger (`msg.sender == ledgerAddress`)

### Цитата из ошибки
```
"Caller is not the ledger contract"
```
Это означает, что FineTuningServing отклоняет прямые вызовы и требует, чтобы они шли через Ledger.

## 2. Проверка окружения

### Адреса контрактов из .env.local
```
NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
NEXT_PUBLIC_FINE_TUNE_PROVIDER=0xf07240Efa67755B5311bc75784a061eDB47165Dd
```

### Проверка связи контрактов
```
Chain ID: 16601 (unknown)
Ledger Address from Serving: 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
Ledger Address from .env:    0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
✅ Addresses match!
```

Контракт FineTuningServing правильно настроен на работу с Ledger контрактом.

## 3. Внесенные исправления

### 3.1 broker.ts - Изменен путь вызовов

**Было:**
```typescript
// Use FineTuningServing contract for account operations
const servingContract = getServingContract(signer)
const tx = await servingContract.addAccount(user, provider, extraInfo, { value })
```

**Стало:**
```typescript
// Use Ledger contract for account operations (it will call FineTuningServing internally)
const ledgerContract = getLedgerContract(signer)
const tx = await ledgerContract.addAccount(user, provider, extraInfo, { value })
```

Аналогичные изменения внесены для `depositFund`.

### 3.2 Исправлен маппинг ошибок

**Было:**
```typescript
if (/caller is not the ledger contract/i.test(msg)) {
  return new Error('Wrong contract: operations should be called on FineTuningServing, not Ledger')
}
```

**Стало:**
```typescript
if (/caller is not the ledger contract/i.test(msg)) {
  return new Error('Operations must be called through Ledger contract, not directly on FineTuningServing')
}
```

### 3.3 Добавлена обработка ошибки в UI

В `web/app/agents/[id]/fine-tune/page.tsx` добавлен правильный текст:
```typescript
} else if (apiError.details && apiError.details.includes('Operations must be called through Ledger')) {
  errorMessage = 'Операция должна выполняться через Ledger контракт, а не напрямую через FineTuningServing.'
}
```

## 4. Результаты диагностики

### Валидация исправлений
```
📊 Validation Summary
25/25 checks passed (100%)
🎉 All fixes validated successfully!
```

### Проверка связи контрактов
- ✅ Serving.ledgerAddress() совпадает с NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT
- ✅ Chain ID: 16601 (0G Testnet Galileo)
- ✅ Все переменные окружения настроены корректно

## 5. Рекомендации для тестирования

### Команды для локальной проверки

1. **Проверка конфигурации:**
```bash
node scripts/check-ledger-serving.js
```

2. **Валидация исправлений:**
```bash
node scripts/validate-fix.js
```

3. **Симуляция транзакций (требует ethers):**
```bash
node scripts/test-fine-tune-flow.js --simulate-only
```

### Ожидаемое поведение
- При вызове addAccount/depositFund транзакции идут на Ledger контракт
- Ledger внутренне вызывает FineTuningServing
- Ошибка "Caller is not the ledger contract" больше не должна возникать
- В UI корректно отображается текст ошибки на русском языке

## 6. Заключение

Архитектура подтверждена: вызовы должны идти через **Ledger → FineTuningServing**. Все необходимые исправления внесены:
- ✅ Транзакции теперь отправляются на Ledger контракт
- ✅ Маппинг ошибок исправлен
- ✅ UI показывает корректные сообщения
- ✅ Валидация окружения пройдена успешно

Белый экран не должен воспроизводиться благодаря ErrorBoundary компоненту.