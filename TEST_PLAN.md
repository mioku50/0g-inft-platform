# Non-Custodial Chat Test Plan

## Предварительные требования
- Node.js 18+
- MetaMask или другой Web3 кошелек
- Тестовые токены OG на Galileo testnet

## Запуск проекта

```bash
cd /workspace/web
npm install --legacy-peer-deps
npm run dev
```

Откройте http://localhost:3000

## Тест-кейсы

### 1. Позитивный сценарий - успешный non-custodial чат

**Шаги:**
1. Подключите кошелек через MetaMask
2. Перейдите на вкладку "Non-Custodial Chat"
3. Дождитесь инициализации (prepare)
4. Отправьте сообщение "Hello, 0G!"

**Ожидаемый результат:**
- В Console DevTools:
  ```
  [CHAT] start
  [CHAT] prepared
  [CHAT] fetch
  [CHAT] processResponse called successfully
  ```
- В Network DevTools:
  - POST /api/compute/chat (200 OK)
  - POST /api/compute/proxy (200 OK)
- В серверных логах:
  ```
  [CHAT] HIT: non-custodial mode
  [PROXY] HIT: provider response received
  ```

### 2. Негативный сценарий - без подключенного кошелька

**Шаги:**
1. Откройте приложение без подключения кошелька
2. Попробуйте использовать Non-Custodial Chat

**Ожидаемый результат:**
- Ошибка на клиенте: "No injected wallet found. Please install MetaMask or connect a wallet."
- Кнопка чата недоступна

### 3. Негативный сценарий - без prepared состояния

**Шаги:**
1. Подключите кошелек
2. Отправьте POST запрос на /api/compute/chat с non_custodial=true но без prepared данных

```bash
curl -X POST http://localhost:3000/api/compute/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Test"}],
    "non_custodial": true
  }'
```

**Ожидаемый результат:**
- Статус: 400 Bad Request
- Ответ: `{ "error": "non_custodial_required", "message": "Non-custodial mode requires prepared data" }`

## Проверка единиц измерения

### SDK использует числа в OG (не BigInt в wei)

**Пример использования:**
```typescript
// Правильно - число в OG
await broker.ledger.addLedger(0.01)  // 0.01 OG
await broker.ledger.depositFund(0.05) // 0.05 OG

// Неправильно - BigInt в wei
await broker.ledger.addLedger(ethers.parseEther('0.01')) // Ошибка!
```

**Где происходит конвертация:**
- В контрактах 0G происходит автоматическая конвертация из OG в wei
- SDK принимает числа в OG и внутренне конвертирует их для контрактов

## Проверка импортов

### Динамический импорт в clientBroker.ts
```typescript
// Динамический импорт только в браузере
if (typeof window === 'undefined') {
  throw new Error('Client broker can only be used in browser environment')
}

// Импорт ESM версии с явным путем
const brokerModule = await import('@0glabs/0g-serving-broker/lib.esm/index.js')
```

**Почему именно этот путь:**
- `@0glabs/0g-serving-broker` - официальный пакет от 0G Labs
- `/lib.esm/index.js` - ESM версия для браузера
- Динамический импорт позволяет избежать SSR проблем в Next.js

## Результаты тестирования

### ✅ Успешные тесты:
- [ ] Non-custodial чат работает с подключенным кошельком
- [ ] SSR не вызывает ошибок "exports is not defined"
- [ ] Ledger Balance показывает корректный баланс
- [ ] processResponse вызывается после получения ответа

### ❌ Известные проблемы:
- [ ] Документировать любые найденные проблемы

## Команды для отладки

```bash
# Проверка логов сервера
npm run dev | grep -E "\[CHAT\]|\[PROXY\]"

# Проверка сборки
npm run build

# Проверка типов
npm run type-check
```