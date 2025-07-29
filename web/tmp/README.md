# Fine-tune Flow Diagnostic & Testing

Этот документ описывает, как запускать диагностику и тестирование flow пополнения аккаунта fine-tune после исправлений.

## Быстрый запуск диагностики

```bash
# Перейти в директорию web
cd web

# Запустить диагностику (только симуляция)
node scripts/test-fine-tune-flow.js --simulate-only

# Запустить с отправкой реальных транзакций (требует приватный ключ)
node scripts/test-fine-tune-flow.js --send-tx --amount 0.01
```

## Что проверяет диагностика

1. **Валидация окружения**
   - Проверка всех переменных окружения
   - Подключение к RPC
   - Проверка баланса кошелька

2. **Валидация контрактов**
   - FineTuningServing контракт развернут
   - Ledger контракт развернут
   - Inference контракт развернут

3. **Проверка провайдера**
   - Провайдер зарегистрирован в FineTuningServing
   - URL провайдера настроен
   - Модели доступны

4. **Статус аккаунта**
   - Аккаунт существует или нет
   - Текущий баланс
   - Pending refunds

5. **Симуляция транзакций**
   - addAccount (если аккаунт не существует)
   - depositFund (если аккаунт существует)
   - Оценка газа и стоимости

## Переменные окружения

Убедитесь, что в `.env.local` настроены:

```bash
# Обязательные
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS=0x...
NEXT_PUBLIC_FINE_TUNE_PROVIDER=0x...

# Опциональные (для отправки транзакций)
OG_COMPUTE_PRIVATE_KEY=0x...

# Контракты (с fallback значениями)
NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=0x...
NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT=0x...
```

## Примеры использования

### Только диагностика (безопасно)
```bash
node scripts/test-fine-tune-flow.js --simulate-only
```

### Создание аккаунта с депозитом 0.05 OG
```bash
node scripts/test-fine-tune-flow.js --send-tx --amount 0.05
```

### Проверка с кастомным провайдером
```bash
NEXT_PUBLIC_FINE_TUNE_PROVIDER=0xCustomProvider node scripts/test-fine-tune-flow.js --simulate-only
```

## Интерпретация результатов

### ✅ Успешная диагностика
- Все контракты развернуты
- Провайдер зарегистрирован
- Симуляция транзакций проходит
- Газ оценивается корректно

### ❌ Возможные проблемы

**ServiceNotExist**: Провайдер не зарегистрирован в FineTuningServing
```
Решение: Провайдер должен вызвать addOrUpdateService()
```

**Contract not deployed**: Контракт не развернут по указанному адресу  
```
Решение: Проверить адреса контрактов в .env.local
```

**AccountExists**: При попытке создать существующий аккаунт
```
Решение: Использовать depositFund вместо addAccount
```

**Insufficient funds**: Недостаточно OG на кошельке
```
Решение: Пополнить кошелек через faucet или bridge
```

## Тестирование через UI

После успешной диагностики можно тестировать через веб-интерфейс:

1. Открыть http://localhost:3000/agents/[id]/fine-tune
2. Проверить статус аккаунта
3. Нажать "Create Account & Deposit" или "Deposit Funds"
4. Проверить статусы транзакций и ссылки на explorer

## Логи и диагностика

### Браузерные логи
Откройте Developer Tools → Console для просмотра:
```
[fine] addAccount:start
[fine] addAccount:provider-validation:ok
[fine] addAccount:simulate:ok
[fine] addAccount:sent
```

### Серверные логи
В терминале с `npm run dev` смотрите:
```
[compute-env] Environment validation: { isValid: true, ... }
[fine] addAccount:success { txHash: '0x...' }
```

## Структура ответов API

### Успешный ответ (201)
```json
{
  "success": true,
  "action": "create",
  "txHash": "0x...",
  "explorerUrl": "https://chainscan-galileo.0g.ai/tx/0x...",
  "status": "submitted",
  "simulation": false,
  "diagnostics": {
    "method": "POST",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "provider": "0x..."
  }
}
```

### Ошибка валидации (409)
```json
{
  "error": "AccountExists",
  "details": "Account already exists. Use action=\"deposit\" to add funds.",
  "diagnostics": { ... }
}
```

### Ошибка контракта (502)
```json
{
  "error": "ContractValidationFailed",
  "details": "The contract rejected the transaction...",
  "reason": "execution reverted",
  "diagnostics": { ... }
}
```

## Troubleshooting

### Белый экран на фронтенде
1. Проверить консоль браузера на React ошибки
2. Убедиться что все переменные окружения настроены
3. Проверить что сервер запущен на правильном порту

### Транзакции отклоняются
1. Запустить диагностику для проверки провайдера
2. Проверить баланс кошелька
3. Убедиться что используется правильная сеть (Galileo testnet)

### Долгое подтверждение транзакций
1. Проверить статус в explorer по ссылке
2. Транзакции могут занимать 1-2 минуты в testnet
3. При таймауте - проверить статус аккаунта через GET API