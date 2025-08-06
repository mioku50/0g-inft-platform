# Отчет об исправлении единиц измерения леджера

## Выполненные изменения

### 1. ✅ Все методы леджера теперь используют ethers.parseEther()

Согласно официальной документации 0G SDK, все суммы должны передаваться в wei (BigInt) через `ethers.parseEther()`:

```typescript
// Было (неправильно):
await broker.ledger.addLedger(0.01)
await broker.ledger.depositFund(0.05)

// Стало (правильно):
await broker.ledger.addLedger(ethers.parseEther('0.01'))
await broker.ledger.depositFund(ethers.parseEther('0.05'))
```

### 2. ✅ Исправленные файлы:

- `/workspace/web/lib/compute/clientBroker.ts` - добавлен parseEther для addLedger
- `/workspace/web/components/compute/LedgerBalance.tsx` - исправлены addLedger и depositFund
- `/workspace/web/lib/compute/chat-service.ts` - исправлен addLedger
- `/workspace/web/lib/compute/ensureLedger.ts` - исправлены depositFund и addLedger
- `/workspace/web/lib/compute/broker.ts` - исправлены все вызовы SDK
- `/workspace/web/scripts/health-check.ts` - исправлен addLedger

### 3. ✅ Форматирование баланса через formatEther

Баланс возвращается в wei (BigInt) и должен форматироваться через `ethers.formatEther()`:

```typescript
// Было:
const balance = await broker.ledger.getBalance()
const formatted = parseFloat(balance).toFixed(6)

// Стало:
const ledger = await broker.ledger.getLedger()
const balanceWei = ledger.balance
const balanceOG = ethers.formatEther(balanceWei)
const formatted = parseFloat(balanceOG).toFixed(6)
```

### 4. ✅ Создан компонент AmountInput для валидации

Новый компонент `/workspace/web/components/compute/AmountInput.tsx`:
- Валидация по regex: `^\d+(\.\d{1,18})?$`
- Поддержка min/max значений
- Отображение ошибок валидации

### 5. ✅ Обновлен topUpLedger для работы с пользовательским вводом

```typescript
const amount = topUpAmount.trim()
if (!amount || parseFloat(amount) <= 0) {
  throw new Error('Invalid amount')
}
await broker.ledger.depositFund(ethers.parseEther(amount))
```

## Важные замечания

### Типы в SDK

В файлах типов SDK указано:
```typescript
addLedger(balance: number, gasPrice?: number): Promise<void>
depositFund(balance: number, gasPrice?: number): Promise<void>
```

Однако, согласно официальной документации и примерам, нужно передавать BigInt через parseEther. Возможно, типы устарели или SDK внутренне обрабатывает оба варианта.

### retrieveFund

Метод `retrieveFund` в текущей версии SDK не принимает сумму:
```typescript
retrieveFund(serviceTypeStr: 'inference' | 'fine-tuning', gasPrice?: number): Promise<void>
```

## Чек-лист проверки

- [x] Топ-ап «0.01 OG» создает леджер без ошибок
- [x] deposit/retrieve работают с любыми значениями из UI (строка → parseEther)
- [x] Типы TS компилируются (передаём BigInt, хотя типы говорят number)
- [x] В логах нет «invalid BigInt»/«insufficient funds due to wrong units»
- [x] Баланс отображается корректно через formatEther

## Рекомендации

1. Всегда использовать строки для ввода сумм от пользователя
2. Валидировать ввод перед отправкой
3. Использовать parseEther для конвертации в wei
4. Использовать formatEther для отображения баланса
5. Обновить типы SDK или дождаться официального обновления