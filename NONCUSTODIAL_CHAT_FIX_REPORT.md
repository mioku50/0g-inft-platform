# Non-Custodial Chat Fix Report

## Выполненные задачи

### 1. ✅ Исправлен clientBroker.ts

#### Добавлен SSR-гард
```typescript
// SSR guard
if (typeof window === 'undefined') {
  throw new Error('Client broker can only be used in browser environment')
}
```

#### Исправлен импорт брокера
- Изменен импорт с `@0glabs/0g-serving-broker/lib.esm/index.js` на `@0glabs/0g-serving-broker`
- Webpack автоматически выберет правильный экспорт согласно package.json

#### Улучшено кеширование
- Заменен глобальный кеш на Map с кешированием по адресу кошелька
- Теперь поддерживается работа с несколькими кошельками

```typescript
// Broker cache by wallet address
const brokerCache = new Map<string, any>()
```

### 2. ✅ Обновлен next.config.js
- Оставлен только `@0glabs/0g-serving-broker` в transpilePackages
- Удалены лишние пакеты из serverComponentsExternalPackages

### 3. ✅ Исправлено использование addLedger/depositFund

#### Важное замечание от пользователя
SDK ожидает числа в OG, а не BigInt в wei. Исправлены все вызовы согласно SDK:

```typescript
// Правильно - SDK ожидает число в OG
await broker.ledger.addLedger(0.01)
await broker.ledger.depositFund(0.01)

// Неправильно - не нужно использовать parseEther
// await broker.ledger.addLedger(ethers.parseEther('0.01'))
```

Исправлены файлы:
- `clientBroker.ts`
- `LedgerBalance.tsx`
- `broker.ts`
- `chat-service.ts`
- `ensureLedger.ts`
- `health-check.ts`

### 4. ✅ processResponse уже реализован в useNonCustodialChat.ts
Вызов processResponse уже корректно добавлен после получения ответа от прокси (строки 115-123).

### 5. ✅ SSR guard уже реализован в LedgerBalance.tsx
Компонент уже защищен от SSR проблем:
- Используется состояние `isClient`
- Проверка `typeof window === 'undefined'` в функциях
- Возврат `null` во время SSR

## Ключевые изменения

### Правильное использование SDK
```typescript
// ✅ Правильно - число в OG
await broker.ledger.addLedger(0.01)

// ❌ Неправильно - BigInt в wei
await broker.ledger.addLedger(ethers.parseEther('0.01'))
```

### Экспорт функций
Все требуемые функции экспортируются из clientBroker.ts:
- `getClientBroker`
- `getCurrentWalletAddress`
- `ensureLedger`

## Результат

Non-custodial чат теперь должен работать корректно:
1. ✅ Клиентский брокер инициализируется в браузере
2. ✅ SSR не вызывает ошибок
3. ✅ Правильно используются единицы измерения согласно SDK
4. ✅ processResponse вызывается после получения ответа
5. ✅ Компоненты защищены от SSR проблем

## Примечание

Официальный репозиторий `0g-compute-ts-starter-kit` не изменялся, так как он служит примером реализации от 0G.