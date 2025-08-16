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
0G Compute SDK

The 0G Compute Network SDK enables developers to integrate AI inference services from the 0G Compute Network into their applications. Currently, the 0G Compute Network SDK supports Large Language Model (LLM) inference services, with fine-tuning and additional features planned for future releases.

In just five minutes, you can initialize your broker to manage operations, set up and fund your account to pay for inference services, and learn how to send inference requests and handle responses.

Quick Start

Installation

pnpm add @0glabs/0g-serving-broker @types/crypto-js@4.2.2 crypto-js@4.2.0


Core Concepts

1. The Broker

Your interface to the 0G Compute Network:

Handles authentication and billing
Manages provider connections
Verifies computations
2. Providers

GPU owners offering AI services:

Each has a unique address
Set their own prices
Run specific models
3. Prepaid Accounts

Fund account before usage
Automatic micropayments
No surprise bills
Step-by-Step Guide

Initialize the Broker

Using Private Key
Browser Wallet
import { BrowserProvider } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

// Check if MetaMask is installed
if (typeof window.ethereum === "undefined") {
  throw new Error("Please install MetaMask");
}

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const broker = await createZGComputeNetworkBroker(signer);


Fund Your Account

// Add 0.1 OG tokens (~10,000 requests)
await broker.ledger.addLedger(ethers.parseEther("0.1"));

// Check balance
const account = await broker.ledger.getLedger();
console.log(`Balance: ${ethers.formatEther(account.balance)} OG`);


Discover Available Services

The 0G Compute Network hosts multiple AI service providers. The service discovery process helps you find and select the appropriate services for your needs.

🎯 Official 0G Services
Model	Provider Address	Description	Verification
llama-3.3-70b-instruct	0xf07240Efa67755B5311bc75784a061eDB47165Dd	State-of-the-art 70B parameter model for general AI tasks	TEE (TeeML)
deepseek-r1-70b	0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3	Advanced reasoning model optimized for complex problem solving	TEE (TeeML)
const services = await broker.inference.listService();


Each service contains the following information:

type ServiceStructOutput = {
  provider: string; // Provider's wallet address (unique identifier)
  serviceType: string; // Type of service
  url: string; // Service URL
  inputPrice: bigint; // Price for input processing
  outputPrice: bigint; // Price for output generation
  updatedAt: bigint; // Last update timestamp
  model: string; // Model identifier
  verifiability: string; // Indicates how the service's outputs can be verified. 'TeeML' means it runs with verification in a Trusted Execution Environment. An empty value means no verification.
};


Acknowledge Provider

Before using a service provided by a provider, you must first acknowledge the provider on-chain by following API:

await broker.inference.acknowledgeProviderSigner(providerAddress)


The providerAddress can be obtained from from service metadata. For details on how to retrieve it, see Discover Available Services

Service Requests

Service usage in the 0G Network involves two key steps:

Retrieving service metadata
Generating authenticated request headers
  
  // Get service details
  const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
  
  // Generate auth headers (single use)
  const headers = await broker.inference.getRequestHeaders(provider, question);
  


Send a Request to the Service

Using Fetch API
Using OpenAI SDK
const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      model: model,
    }),
  });
  
const data = await response.json();
const answer = data.choices[0].message.content;



Response Processing

This function is used to verify the response. If it is a verifiable service, it will return whether the response is valid.

const valid = await broker.inference.processResponse(
  providerAddress,
  content,
  chatID // Optional: Only for verifiable services
);


Fee Settlement

Fee settlement by the broker service occurs at scheduled intervals.

Account Management

Check Balance

const ledger = await broker.ledger.getLedger();
console.log(`
  Balance: ${ethers.formatEther(ledger.balance)} OG
  Locked: ${ethers.formatEther(ledger.locked)} OG
  Available: ${ethers.formatEther(ledger.balance - ledger.locked)} OG
`);


Add Funds

// Add more funds
await broker.ledger.depositFund(ethers.parseEther("0.5"));


Request Refund

// Withdraw unused funds
const amount = ethers.parseEther("0.1");
await broker.ledger.retrieveFund("inference", amount);


Troubleshooting

Common Issues

Error: Insufficient balance
Your account doesn't have enough funds. Add more:

await broker.ledger.addLedger(ethers.parseEther("0.1"));


Error: Headers already used
Request headers are single-use. Generate new ones for each request:

// ❌ Wrong
const headers = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers);
await makeRequest(headers); // Will fail!

// ✅ Correct
const headers1 = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers1);
const headers2 = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers2);


Error: Provider not responding
The provider might be offline. Try another:

// Try all official providers
for (const [model, provider] of Object.entries(OFFICIAL_PROVIDERS)) {
  try {
    console.log(`Trying ${model}...`);
    return await makeRequestToProvider(provider);
  } catch (e) {
    console.log(`${model} failed, trying next...`);
    continue; // Try next 

    INFT Integration Guide

Overview

This step-by-step guide shows you how to integrate INFTs into your applications using the 0G ecosystem. You'll learn to deploy contracts, manage metadata, and implement secure transfers.

QUICK NAVIGATION
New to INFTs? Start with INFT Overview
Need technical details? See ERC-7857 Standard
Ready to build? Continue with this guide
Prerequisites

Knowledge Requirements

✅ NFT Standards - Understanding of ERC-721 basics
✅ Smart Contracts - Solidity development experience
✅ Cryptography - Basic encryption and key management concepts
✅ 0G Ecosystem - Familiarity with 0G infrastructure components

Technical Setup

✅ Development Environment - Node.js 16+, Hardhat/Foundry
✅ 0G Testnet Account - Wallet with testnet tokens
✅ API Access - Keys for 0G Storage and Compute services

Quick Setup Checklist
Understanding 0G Integration

INFTs work seamlessly with 0G's complete AI infrastructure:

Component	Purpose	INFT Integration
0G Storage	Encrypted metadata storage	Stores AI agent data securely
0G DA	Proof verification	Validates transfer integrity
0G Chain	Smart contract execution	Hosts INFT contracts
0G Compute	Secure AI inference	Runs agent computations privately
WHY THIS ARCHITECTURE MATTERS
This integration ensures that AI agents maintain their intelligence, privacy, and functionality throughout their entire lifecycle while remaining fully decentralized.
Step-by-Step Implementation

Step 1: Initialize Your Project

# Create new project
mkdir my-inft-project && cd my-inft-project
npm init -y

# Install required dependencies
npm install @0glabs/0g-ts-sdk @openzeppelin/contracts ethers hardhat
npm install --save-dev @nomicfoundation/hardhat-toolbox

# Initialize Hardhat
npx hardhat init


Configure environment:

# Create .env file
cat > .env << EOF
PRIVATE_KEY=your_private_key_here
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_STORAGE_URL=https://storage-testnet.0g.ai
OG_COMPUTE_URL=https://compute-testnet.0g.ai
EOF


Step 2: Create INFT Smart Contract

// contracts/INFT.sol
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
}

contract INFT is ERC721, Ownable, ReentrancyGuard {
    // State variables
    mapping(uint256 => bytes32) private _metadataHashes;
    mapping(uint256 => string) private _encryptedURIs;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;
    
    address public oracle;
    uint256 private _nextTokenId = 1;
    
    // Events
    event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);
    
    constructor(
        string memory name,
        string memory symbol,
        address _oracle
    ) ERC721(name, symbol) {
        oracle = _oracle;
    }
    
    function mint(
        address to,
        string calldata encryptedURI,
        bytes32 metadataHash
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        _encryptedURIs[tokenId] = encryptedURI;
        _metadataHashes[tokenId] = metadataHash;
        
        return tokenId;
    }
    
    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external nonReentrant {
        require(ownerOf(tokenId) == from, "Not owner");
        require(IOracle(oracle).verifyProof(proof), "Invalid proof");
        
        // Update metadata access for new owner
        _updateMetadataAccess(tokenId, to, sealedKey, proof);
        
        // Transfer token ownership
        _transfer(from, to, tokenId);
        
        emit MetadataUpdated(tokenId, keccak256(sealedKey));
    }
    
    function authorizeUsage(
        uint256 tokenId,
        address executor,
        bytes calldata permissions
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _authorizations[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor);
    }
    
    function _updateMetadataAccess(
        uint256 tokenId,
        address newOwner,
        bytes calldata sealedKey,
        bytes calldata proof
    ) internal {
        // Extract new metadata hash from proof
        bytes32 newHash = bytes32(proof[0:32]);
        _metadataHashes[tokenId] = newHash;
        
        // Update encrypted URI if provided in proof
        if (proof.length > 64) {
            string memory newURI = string(proof[64:]);
            _encryptedURIs[tokenId] = newURI;
        }
    }
    
    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        return _metadataHashes[tokenId];
    }
    
    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        return _encryptedURIs[tokenId];
    }
}


Step 3: Deploy and Initialize Contract

Create deployment script:

// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with account:", deployer.address);
    
    // Deploy mock oracle for testing (replace with real oracle in production)
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.deployed();
    
    // Deploy INFT contract
    const INFT = await ethers.getContractFactory("INFT");
    const inft = await INFT.deploy(
        "AI Agent NFTs",
        "AINFT",
        oracle.address
    );
    await inft.deployed();
    
    console.log("Oracle deployed to:", oracle.address);
    console.log("INFT deployed to:", inft.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});


Deploy to 0G testnet:

npx hardhat run scripts/deploy.js --network og-testnet


Step 4: Implement Metadata Management

Create metadata manager:

// lib/MetadataManager.js
const { ethers } = require('ethers');
const crypto = require('crypto');

class MetadataManager {
    constructor(ogStorage, encryptionService) {
        this.storage = ogStorage;
        this.encryption = encryptionService;
    }
    
    async createAIAgent(aiModelData, ownerPublicKey) {
        try {
            // Prepare AI agent metadata
            const metadata = {
                model: aiModelData.model,
                weights: aiModelData.weights,
                config: aiModelData.config,
                capabilities: aiModelData.capabilities,
                version: '1.0',
                createdAt: Date.now()
            };
            
            // Generate encryption key
            const encryptionKey = crypto.randomBytes(32);
            
            // Encrypt metadata
            const encryptedData = await this.encryption.encrypt(
                JSON.stringify(metadata),
                encryptionKey
            );
            
            // Store on 0G Storage
            const storageResult = await this.storage.store(encryptedData);
            
            // Seal key for owner
            const sealedKey = await this.encryption.sealKey(
                encryptionKey,
                ownerPublicKey
            );
            
            // Generate metadata hash
            const metadataHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(JSON.stringify(metadata))
            );
            
            return {
                encryptedURI: storageResult.uri,
                sealedKey,
                metadataHash
            };
        } catch (error) {
            throw new Error(`Failed to create AI agent: ${error.message}`);
        }
    }
    
    async mintINFT(contract, recipient, aiAgentData) {
        const { encryptedURI, sealedKey, metadataHash } = aiAgentData;
        
        const tx = await contract.mint(
            recipient,
            encryptedURI,
            metadataHash
        );
        
        const receipt = await tx.wait();
        const tokenId = receipt.events[0].args.tokenId;
        
        return {
            tokenId,
            sealedKey,
            transactionHash: receipt.transactionHash
        };
    }
}

module.exports = MetadataManager;


Step 5: Implement Secure Transfers

Transfer preparation:

// lib/TransferManager.js
class TransferManager {
    constructor(oracle, metadataManager) {
        this.oracle = oracle;
        this.metadata = metadataManager;
    }
    
    async prepareTransfer(tokenId, fromAddress, toAddress, toPublicKey) {
        try {
            // Retrieve current metadata
            const currentURI = await this.metadata.getEncryptedURI(tokenId);
            const encryptedData = await this.storage.retrieve(currentURI);
            
            // Request oracle to re-encrypt for new owner
            const transferRequest = {
                tokenId,
                encryptedData,
                fromAddress,
                toAddress,
                toPublicKey
            };
            
            // Get oracle proof and new sealed key
            const oracleResponse = await this.oracle.processTransfer(transferRequest);
            
            return {
                sealedKey: oracleResponse.sealedKey,
                proof: oracleResponse.proof,
                newEncryptedURI: oracleResponse.newURI
            };
        } catch (error) {
            throw new Error(`Transfer preparation failed: ${error.message}`);
        }
    }
    
    async executeTransfer(contract, transferData) {
        const { from, to, tokenId, sealedKey, proof } = transferData;
        
        const tx = await contract.transfer(
            from,
            to,
            tokenId,
            sealedKey,
            proof
        );
        
        return await tx.wait();
    }
}


Best Practices

🔒 Security Guidelines

Key Management:

Store private keys in hardware wallets or HSMs
Never expose keys in code or logs
Implement automatic key rotation
Use multi-signature wallets for critical operations
Metadata Protection:

// Example: Secure metadata handling
class SecureMetadata {
    constructor() {
        this.encryptionAlgorithm = 'aes-256-gcm';
        this.keyDerivation = 'pbkdf2';
    }
    
    async encryptMetadata(data, password) {
        const salt = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(this.encryptionAlgorithm, key, iv);
        // ... encryption logic
    }
}


⚡ Performance Optimization

Efficient Storage Patterns:

Compress metadata before encryption
Use appropriate storage tiers based on access patterns
Implement lazy loading for large AI models
Cache frequently accessed data locally
Batch Operations:

// Batch multiple operations
async function batchMintINFTs(agents, recipients) {
    const operations = agents.map((agent, i) => 
        metadataManager.createAIAgent(agent, recipients[i])
    );
    
    const results = await Promise.all(operations);
    return results;
}


🧪 Testing Strategy

Comprehensive Test Suite:

// test/INFT.test.js
describe('INFT Contract', function () {
    it('should mint INFT with encrypted metadata', async function () {
        const metadata = await createTestMetadata();
        const result = await inft.mint(owner.address, metadata.uri, metadata.hash);
        expect(result).to.emit(inft, 'Transfer');
    });
    
    it('should transfer with re-encryption', async function () {
        // Test secure transfer logic
    });
    
    it('should authorize usage without ownership transfer', async function () {
        // Test authorization functionality
    });
});


Security Testing:

Test with malformed proofs
Verify access controls
Check for reentrancy vulnerabilities
Validate oracle responses
Real-World Use Cases

🏪 AI Agent Marketplace

Complete marketplace integration:

// marketplace/AgentMarketplace.js
class AgentMarketplace {
    constructor(inftContract, paymentToken) {
        this.inft = inftContract;
        this.payment = paymentToken;
        this.listings = new Map();
    }
    
    async listAgent(tokenId, price, description) {
        // Verify ownership
        const owner = await this.inft.ownerOf(tokenId);
        require(owner === msg.sender, 'Not owner');
        
        // Create listing
        const listing = {
            tokenId,
            price,
            description,
            seller: owner,
            isActive: true
        };
        
        this.listings.set(tokenId, listing);
        
        // Approve marketplace for transfer
        await this.inft.approve(this.address, tokenId);
        
        return listing;
    }
    
    async purchaseAgent(tokenId, buyerPublicKey) {
        const listing = this.listings.get(tokenId);
        require(listing && listing.isActive, 'Agent not for sale');
        
        // Prepare secure transfer
        const transferData = await this.prepareTransfer(
            tokenId,
            listing.seller,
            msg.sender,
            buyerPublicKey
        );
        
        // Execute payment
        await this.payment.transferFrom(msg.sender, listing.seller, listing.price);
        
        // Execute secure transfer
        await this.inft.transfer(
            listing.seller,
            msg.sender,
            tokenId,
            transferData.sealedKey,
            transferData.proof
        );
        
        // Remove listing
        this.listings.delete(tokenId);
    }
}


💼 AI-as-a-Service Platform

Usage authorization system:

// services/AIaaS.js
class AIaaSPlatform {
    async createSubscription(tokenId, subscriber, duration, permissions) {
        // Verify agent ownership
        const owner = await this.inft.ownerOf(tokenId);
        
        // Create usage authorization
        const authData = {
            subscriber,
            expiresAt: Date.now() + duration,
            permissions: {
                maxRequests: permissions.maxRequests,
                allowedOperations: permissions.operations,
                rateLimit: permissions.rateLimit
            }
        };
        
        // Grant usage rights
        await this.inft.authorizeUsage(
            tokenId,
            subscriber,
            ethers.utils.toUtf8Bytes(JSON.stringify(authData))
        );
        
        return authData;
    }
    
    async executeAuthorizedInference(tokenId, input, subscriber) {
        // Verify authorization
        const auth = await this.getAuthorization(tokenId, subscriber);
        require(auth && auth.expiresAt > Date.now(), 'Unauthorized');
        
        // Execute inference on 0G Compute
        const result = await this.ogCompute.executeSecure({
            tokenId,
            executor: subscriber,
            input,
            verificationMode: 'TEE'
        });
        
        // Update usage metrics
        await this.updateUsageMetrics(tokenId, subscriber);
        
        return result;
    }
}


🤝 Multi-Agent Collaboration

Agent composition framework:

// collaboration/AgentComposer.js
class AgentComposer {
    async composeAgents(agentTokenIds, compositionRules) {
        // Verify ownership of all agents
        for (const tokenId of agentTokenIds) {
            const owner = await this.inft.ownerOf(tokenId);
            require(owner === msg.sender, `Not owner of agent ${tokenId}`);
        }
        
        // Create composite agent metadata
        const compositeMetadata = {
            type: 'composite',
            agents: agentTokenIds,
            rules: compositionRules,
            createdAt: Date.now()
        };
        
        // Encrypt and store composite metadata
        const encryptedComposite = await this.metadataManager.createAIAgent(
            compositeMetadata,
            msg.sender
        );
        
        // Mint new INFT for composite agent
        const result = await this.inft.mint(
            msg.sender,
            encryptedComposite.encryptedURI,
            encryptedComposite.metadataHash
        );
        
        return result.tokenId;
    }
    
    async executeCompositeInference(compositeTokenId, input) {
        // Retrieve composite metadata
        const metadata = await this.getDecryptedMetadata(compositeTokenId);
        
        // Execute inference on each component agent
        const agentResults = await Promise.all(
            metadata.agents.map(agentId => 
                this.executeAgentInference(agentId, input)
            )
        );
        
        // Apply composition rules to combine results
        const finalResult = this.applyCompositionRules(
            agentResults,
            metadata.rules
        );
        
        return finalResult;
    }
}


Troubleshooting

Common Issues & Solutions

Transfer Failures
Problem: INFT transfer transaction reverts

Causes & Solutions:

Invalid proof: Verify oracle is online and proof is correctly formatted
Expired proof: Generate new proof (proofs have limited validity)
Wrong owner: Ensure from address matches actual token owner
Oracle unavailable: Check oracle service status
// Debug transfer issues
async function debugTransfer(tokenId, proof) {
    const owner = await inft.ownerOf(tokenId);
    console.log(`Token owner: ${owner}`);
    
    const isValidProof = await oracle.verifyProof(proof);
    console.log(`Proof valid: ${isValidProof}`);
    
    // Check oracle status
    const oracleStatus = await oracle.getStatus();
    console.log(`Oracle status: ${oracleStatus}`);
}


Metadata Access Issues
Problem: Cannot decrypt or access AI agent metadata

Solutions:

Verify private key corresponds to sealed key
Check storage URI accessibility
Ensure metadata hasn't been corrupted
Validate encryption algorithm compatibility
// Test metadata access
async function testMetadataAccess(tokenId, privateKey) {
    try {
        const encryptedURI = await inft.getEncryptedURI(tokenId);
        const encryptedData = await storage.retrieve(encryptedURI);
        
        // Attempt decryption
        const sealedKey = await getSealedKey(tokenId);
        const key = await unsealKey(sealedKey, privateKey);
        const metadata = await decrypt(encryptedData, key);
        
        console.log('Metadata accessible:', !!metadata);
        return metadata;
    } catch (error) {
        console.error('Metadata access failed:', error.message);
    }
}


High Gas Costs
Optimization strategies:

Compress proofs before submission
Use batch operations for multiple transfers
Optimize storage patterns
Consider Layer 2 solutions
// Optimize gas usage
async function optimizedTransfer(transfers) {
    // Batch multiple transfers
    const batchData = transfers.map(t => ({
        tokenId: t.tokenId,
        from: t.from,
        to: t.to,
        sealedKey: compressData(t.sealedKey),
        proof: compressProof(t.proof)
    }));
    
    return await inft.batchTransfer(
