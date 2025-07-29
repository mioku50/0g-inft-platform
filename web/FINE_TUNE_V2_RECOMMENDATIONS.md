# Рекомендации по изменению логики Fine Tune

## Основные выводы из анализа CLI и документации

### 1. Текущие проблемы

1. **Неправильная работа с моделями**
   - Мы используем hash модели вместо имени
   - Не проверяем доступные модели у провайдера
   - Не загружаем конфигурацию модели

2. **Отсутствие расчета размера данных**
   - CLI использует `calculate-token` для точного расчета
   - Мы передаем произвольный размер или 0

3. **Неправильный расчет fee**
   - Fee должна рассчитываться как: `dataSize * pricePerByte`
   - У нас захардкожена как 0.001

4. **Формат датасета**
   - Провайдер ожидает zip файл с определенной структурой
   - Мы загружаем простой текстовый файл

### 2. Правильный flow согласно CLI

```bash
# 1. Создание аккаунта
0g-compute-cli add-account --amount 0.1

# 2. Просмотр провайдеров
0g-compute-cli list-providers

# 3. Просмотр моделей
0g-compute-cli list-models

# 4. Загрузка шаблона конфигурации (опционально)
0g-compute-cli model-usage --provider <PROVIDER> --model <MODEL> --output config.toml

# 5. Подготовка датасета в правильном формате

# 6. Загрузка датасета
0g-compute-cli upload --data-path <PATH_TO_DATASET>

# 7. Расчет размера токенов
0g-compute-cli calculate-token \
  --model <MODEL_NAME> \
  --dataset-path <PATH_TO_DATASET> \
  --provider <PROVIDER_ADDRESS>

# 8. Создание задачи
0g-compute-cli create-task \
  --provider <PROVIDER_ADDRESS> \
  --model <MODEL_NAME> \
  --dataset <DATASET_ROOT_HASH> \
  --config-path <PATH_TO_CONFIG_FILE> \
  --data-size <DATASET_SIZE>

# 9. Мониторинг
0g-compute-cli get-task --provider <PROVIDER> --task <TASK_ID>
0g-compute-cli get-log --provider <PROVIDER> --task <TASK_ID>

# 10. Подтверждение и загрузка модели
0g-compute-cli acknowledge-model --provider <PROVIDER> --data-path <PATH>

# 11. Расшифровка модели
0g-compute-cli decrypt-model --provider <PROVIDER> --encrypted-model <PATH> --output <PATH>
```

### 3. Что нужно изменить в нашем коде

#### 3.1. Добавить методы в FineTuneService:
- `listProviders()` - получение списка провайдеров
- `listModels()` - получение доступных моделей
- `getModelUsage()` - загрузка конфигурации модели
- `calculateTokenSize()` - расчет размера датасета
- `getTaskLogs()` - получение логов обучения

#### 3.2. Изменить createTask:
- Использовать имя модели, а не hash
- Правильно рассчитывать fee через dataSize * pricePerByte
- Передавать training config из getModelUsage или дефолтную

#### 3.3. Изменить формат датасета:
- Создавать zip архив с правильной структурой
- Добавить валидацию формата перед загрузкой

#### 3.4. Улучшить мониторинг:
- Добавить получение логов обучения
- Показывать детальный прогресс

### 4. Проблема из логов

В логах видна ошибка:
```
Error executing task: zip: not a valid zip file
```

Это подтверждает, что провайдер ожидает zip файл, а не текстовый.

### 5. Рекомендуемый план миграции

1. **Фаза 1: Добавить новые методы**
   - Реализовать FineTuneServiceV2 с полным функционалом CLI
   - Создать новые API endpoints
   - Не ломать существующий функционал

2. **Фаза 2: Обновить UI**
   - Добавить выбор провайдера
   - Добавить выбор модели из списка
   - Показывать расчет fee перед созданием задачи
   - Улучшить подготовку датасета

3. **Фаза 3: Миграция**
   - Переключить UI на новые endpoints
   - Удалить старый код после тестирования

### 6. Критические изменения

1. **Использовать SDK метод createTask правильно:**
```typescript
// Неправильно (текущий код):
const tx = await broker.fineTuning.createTask(
  provider,
  modelHash, // ❌ hash вместо имени
  datasetHash,
  trainingParams,
  fee
)

// Правильно:
const tx = await broker.fineTuning.createTask(
  provider,
  modelName, // ✅ имя модели
  datasetHash,
  trainingParams,
  fee
)
```

2. **Правильный расчет fee:**
```typescript
const pricePerByte = await getProviderPrice(provider)
const dataSize = await calculateTokenSize(model, dataset)
const fee = dataSize * pricePerByte
```

3. **Формат датасета:**
- Нужно создавать zip файл с определенной структурой
- Или использовать формат, который ожидает провайдер

### 7. Дополнительные улучшения

1. **Кеширование списков:**
   - Кешировать список провайдеров
   - Кешировать список моделей

2. **Обработка ошибок:**
   - Добавить retry логику
   - Улучшить сообщения об ошибках

3. **UX улучшения:**
   - Показывать примерную стоимость
   - Валидировать датасет перед загрузкой
   - Показывать прогресс в реальном времени