# Отчет об исправлении ошибки сборки

## Проблема

При запуске `npm run build` возникала ошибка:
```
Module not found: Package path ./lib.esm/index.js is not exported from package @0glabs/0g-serving-broker
```

## Причина

В package.json пакета @0glabs/0g-serving-broker exports указывает:
```json
"exports": {
  "types": "./types/index.d.ts",
  "require": "./lib.commonjs/index.js",
  "import": "./lib.esm/index.mjs"  // Обратите внимание на .mjs
}
```

Мы пытались импортировать `./lib.esm/index.js`, но правильный путь - это автоматический выбор через корневой импорт.

## Решение

### 1. Исправлен импорт в clientBroker.ts

```typescript
// Было:
const brokerModule = await import('@0glabs/0g-serving-broker/lib.esm/index.js')

// Стало:
const brokerModule = await import('@0glabs/0g-serving-broker')
```

При динамическом импорте webpack/Next.js автоматически выберет правильный экспорт согласно условиям (import для ESM).

### 2. Исправлены ошибки с undefined.split()

В нескольких файлах была проблема с вызовом split на потенциально undefined значениях:

```typescript
// Было:
const cleanValue = rawValue.split('#')[0].trim().toLowerCase()

// Стало:
const cleanValue = rawValue?.split('#')[0]?.trim()?.toLowerCase() || ''
```

Исправлено в файлах:
- `/workspace/web/lib/server/compute-env.ts`
- `/workspace/web/lib/utils/parse-bool-env.ts`
- `/workspace/web/lib/utils/fine-tuning-utils.ts`

### 3. Добавлен runtime для API роутов

В `/workspace/web/app/api/compute/analyze-prompt/route.ts` добавлен:
```typescript
export const runtime = 'nodejs'
```

## Проверка

Сервер успешно запускается:
```bash
npm run dev
# API health check возвращает 200 OK
```

## Рекомендации

1. Использовать корневой импорт `@0glabs/0g-serving-broker` вместо явных путей
2. Всегда проверять на undefined перед вызовом методов строк
3. Убедиться, что transpilePackages содержит необходимые пакеты в next.config.js