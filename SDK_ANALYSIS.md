# Анализ SDK компонентов 0G Serving Network

## Обзор архитектуры

Платформа 0G Serving Network состоит из четырех основных SDK компонентов, каждый из которых выполняет специфические функции в экосистеме децентрализованного ИИ:

## 1. 0G Serving Broker (`web/lib/0g-serving-broker`)

### Основные компоненты
**Язык**: Go  
**Основная точка входа**: `api/main.go`

### Архитектура сервисов
Брокер развертывается как группа контейнеров с четырьмя основными компонентами:

```go
applets := map[string]func(){
    "0g-inference-server":        providerServer.Main,
    "0g-inference-event":         providerEvent.Main,
    "0g-inference-router-server": routerServer.Main,
    "0g-fine-tuning-server":      fineTuningServer.Main,
}
```

#### Функции компонентов:
- **0g-inference-server**: Обрабатывает регистрацию сервисов, расчеты и проксирование пользовательских запросов
- **0g-inference-event**: Периодически выполняет расчеты комиссий для обеспечения баланса пользователей
- **0g-inference-router-server**: Маршрутизация запросов между провайдерами
- **0g-fine-tuning-server**: Сервисы дообучения моделей
- **0g-serving-provider-broker-db**: База данных для записи регистраций сервисов и информации о запросах
- **zk-provider-server**: Проверка пользовательских запросов на наличие валидных подписей

### Роль в экосистеме
Провайдер является ключевым компонентом архитектуры 0G Serving Network, отвечающим за:
- Регистрацию сервисов в сети
- Обработку расчетов между пользователями и провайдерами
- Проксирование запросов к ИИ сервисам

## 2. 0G Serving Contract (`web/lib/0g-serving-contract`)

### Основные компоненты
**Язык**: Solidity  
**Точки входа**: Смарт-контракты в папке `contracts/`

### Ключевые контракты:

#### `Serving.sol`
- Главная точка входа для управления аккаунтами и сервисами
- Обрабатывает процесс расчета комиссий
- Валидирует доказательства расчетов

#### `Account.sol`
- Управляет пользовательскими аккаунтами и балансами
- Обрабатывает депозиты и выводы средств
- Отслеживает расходы на ИИ сервисы

#### `Service.sol`
- Управляет информацией о сервисах (регистрация, обновления, удаление)
- Хранит метаданные провайдеров (URL, модели, цены)
- Контролирует доступ к сервисам

#### `BatchVerifier.sol`
- Реализует основную логику проверки доказательств расчетов
- Код генерируется [ZK Settlement Server](https://github.com/0glabs/0g-zk-settlement-server)
- Проверяет доказательства и публичные входы от провайдера сервисов

### Функции в архитектуре:
- Валидация доказательств расчетов
- Управление аккаунтами пользователей
- Хранение информации о сервисах
- Консенсус логика для расчетов

## 3. 0G Serving User Broker (`web/lib/0g-serving-user-broker`)

### Основные компоненты
**Язык**: TypeScript SDK  
**Основная точка входа**: `src.ts/sdk/index.ts`

### Главный класс ZGComputeNetworkBroker

```typescript
export class ZGComputeNetworkBroker {
    public ledger!: LedgerBroker
    public inference!: InferenceBroker
    public fineTuning?: FineTuningBroker
}
```

#### Фабричная функция создания:
```typescript
export async function createZGComputeNetworkBroker(
    signer: JsonRpcSigner | Wallet,
    ledgerCA = '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
    inferenceCA = '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
    fineTuningCA = '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
    gasPrice?: number
): Promise<ZGComputeNetworkBroker>
```

### Утилиты и основные функции:

#### Управление лeджером (`ledger`):
- `addLedger(balance)` - создание нового аккаунта с начальным балансом
- `depositFund(amount)` - пополнение средств на аккаунт
- `getLedger()` - получение информации об аккаунте и балансе
- `retrieveFund(type, amount)` - вывод неиспользованных средств

#### Инференс сервисы (`inference`):
- `listService()` - получение списка доступных ИИ сервисов
- `acknowledgeProviderSigner(providerAddress)` - подтверждение провайдера (требуется один раз)
- `getServiceMetadata(providerAddress)` - получение метаданных сервиса (endpoint, model)
- `getRequestHeaders(providerAddress, content)` - генерация заголовков авторизации (одноразовые)
- `processResponse(providerAddress, content, chatID)` - обработка ответа и верификация

#### Дообучение моделей (`fineTuning`):
- Доступно только для Wallet инстансов
- Управление процессами дообучения моделей

### Пример использования (из inference-server.ts):

```typescript
// Инициализация брокера
const broker = await createZGComputeNetworkBroker(
    new ethers.Wallet(privateKey, provider)
)

// Подтверждение провайдера
await broker.inference.acknowledgeProviderSigner(providerAddress)

// Получение метаданных сервиса
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)

// Генерация заголовков авторизации
const headers = await broker.inference.getRequestHeaders(providerAddress, content)

// Отправка запроса (OpenAI-совместимый API)
const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ messages, model })
})

// Обработка ответа и верификация
const isValid = await broker.inference.processResponse(providerAddress, content, chatId)
```

### Фронтенд интеграция:
SDK обеспечивает полную совместимость с OpenAI API, позволяя легко интегрировать децентрализованные ИИ сервисы в существующие приложения.

## 4. 0G Compute TS Starter Kit (`web/lib/0g-compute-ts-starter-kit`)

### Основные компоненты
**Язык**: TypeScript REST API  
**Основная точка входа**: `src/index.ts` (Express приложение)  
**Демо-скрипт**: `demo-compute-flow.ts`

### Архитектура REST API:

#### Структура файлов:
```
src/
├── config/swagger.ts           # Конфигурация Swagger/OpenAPI
├── controllers/
│   ├── accountController.ts    # Контроллеры управления аккаунтом
│   └── serviceController.ts    # Контроллеры ИИ сервисов
├── routes/
│   ├── accountRoutes.ts        # Маршруты аккаунта
│   └── serviceRoutes.ts        # Маршруты сервисов
├── services/brokerService.ts   # Основная интеграция с 0G брокером
├── index.ts                    # Точка входа Express приложения
└── startup.ts                  # Инициализация приложения
```

### Официальные провайдеры ИИ:

```typescript
const OFFICIAL_PROVIDERS = {
  "llama-3.3-70b-instruct": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "deepseek-r1-70b": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3"
}
```

### API эндпоинты:

#### Управление аккаунтом:
- `GET /api/account/info` - получение информации об аккаунте
- `POST /api/account/deposit` - пополнение средств на леджер
- `POST /api/account/refund` - запрос возврата неиспользованных средств

#### ИИ сервисы:
- `GET /api/services/list` - список доступных ИИ сервисов
- `POST /api/services/acknowledge-provider` - подтверждение провайдера
- `POST /api/services/query` - отправка запроса к ИИ сервису
- `POST /api/services/settle-fee` - ручное урегулирование комиссий (legacy)

### Основной workflow процесса (prepare → proxy → processResponse):

#### Пример из demo-compute-flow.ts:

```typescript
async function testComputeFlow() {
    // 1. PREPARE: Инициализация кошелька и брокера
    const wallet = new ethers.Wallet(privateKey, provider)
    const broker = await createZGComputeNetworkBroker(wallet)
    
    // 2. Настройка леджер аккаунта
    await broker.ledger.addLedger(0.1) // 0.1 OG токенов
    
    // 3. Подтверждение провайдера (одноразово)
    await broker.inference.acknowledgeProviderSigner(providerAddress)
    
    // 4. PROXY: Получение метаданных и генерация заголовков
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
    const headers = await broker.inference.getRequestHeaders(providerAddress, query)
    
    // 5. Отправка запроса через OpenAI SDK
    const openai = new OpenAI({ baseURL: endpoint, apiKey: "" })
    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: query }],
        model
    }, { headers })
    
    // 6. PROCESS RESPONSE: Обработка ответа и верификация
    const isValid = await broker.inference.processResponse(
        providerAddress,
        completion.choices[0].message.content,
        completion.id // chatId для TEE верификации
    )
}
```

### Сервис брокера (brokerService.ts):

Singleton класс `BrokerService` предоставляет высокоуровневые методы:

```typescript
class BrokerService {
    // Управление средствами
    async depositFunds(amount: number): Promise<string>
    async addFundsToLedger(amount: number): Promise<string>
    async getBalance(): Promise<any>
    async requestRefund(amount: number): Promise<string>
    
    // Управление провайдерами
    async acknowledgeProvider(providerAddress: string): Promise<string>
    async listServices(): Promise<any[]>
    
    // Отправка запросов
    async sendQuery(providerAddress: string, query: string, fallbackFee?: number): Promise<any>
}
```

### Особенности безопасности:
- **Одноразовые заголовки**: Заголовки авторизации генерируются для каждого запроса
- **TEE верификация**: Поддержка проверки ответов через Trusted Execution Environment
- **Автоматические микроплатежи**: Система автоматически обрабатывает платежи за использование ИИ
- **Проверка входных данных**: Валидация параметров запросов на всех эндпоинтах

## Сводный анализ workflow

### Основной поток использования SDK:

1. **Инициализация** (`prepare`):
   - Создание кошелька ethers.js
   - Инициализация ZGComputeNetworkBroker
   - Создание/пополнение леджер аккаунта
   - Подтверждение провайдеров (одноразово для каждого)

2. **Проксирование** (`proxy`):
   - Получение метаданных сервиса (endpoint, model)
   - Генерация одноразовых заголовков авторизации
   - Отправка OpenAI-совместимого запроса
   - Получение ответа с chat ID

3. **Обработка ответа** (`processResponse`):
   - Верификация ответа через TEE (если поддерживается)
   - Автоматическое урегулирование микроплатежей
   - Возврат результата с метаданными

### Ключевые утилиты:

- **createZGComputeNetworkBroker()** - основная фабричная функция
- **getRequestHeaders()** - генератор заголовков авторизации
- **processResponse()** - обработчик ответов и платежей
- **listService()** - получение доступных сервисов
- **acknowledgeProviderSigner()** - подтверждение провайдеров

### Интеграционные паттерны:

1. **Прямая интеграция** - использование SDK напрямую в приложении
2. **Proxy сервер** - развертывание OpenAI-совместимого прокси
3. **REST API** - готовое API решение со Swagger документацией
4. **CLI интерфейс** - командная строка для разработчиков

Все четыре SDK компонента работают совместно для обеспечения полноценной экосистемы децентрализованного ИИ с автоматическими микроплатежами, верификацией через TEE и простой интеграцией через OpenAI-совместимый API.