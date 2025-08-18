# 0G SDK Technical Implementation Guide

## File Structure Analysis

### 1. 0g-serving-broker (Go Backend Service)
```
web/lib/0g-serving-broker/
├── api/
│   ├── main.go                 # Main entry point - service launcher
│   ├── common/                 # Common utilities and configurations  
│   ├── fine-tuning/           # Fine-tuning service implementation
│   ├── inference/             # Inference service components
│   └── inference-router/      # Request routing logic
├── doc/                       # Documentation and architecture diagrams
└── README.md                  # Service overview and deployment guide
```

**Key Entry Points:**
- `main.go`: Service selector launching specific applets
- Supports 4 service types: inference-server, inference-event, router-server, fine-tuning-server

### 2. 0g-serving-contract (Solidity Smart Contracts)
```
web/lib/0g-serving-contract/
├── contracts/
│   ├── inference/             # Inference-related contracts
│   ├── ledger/               # Ledger management contracts  
│   ├── fine-tuning/          # Fine-tuning contracts
│   ├── proxy/                # Proxy pattern implementations
│   └── utils/                # Utility contracts
├── src/
│   ├── deploy/               # Deployment scripts
│   │   ├── deploy_compute_network.ts
│   │   ├── deploy_inference_serving.ts
│   │   └── deploy_ledger_manager.ts
│   ├── tasks/                # Hardhat tasks
│   └── utils/                # Contract utilities
├── hardhat.config.ts         # Hardhat configuration
├── package.json             # NPM dependencies
└── README.md                # Contract architecture overview
```

**Key Smart Contracts:**
- `Serving.sol`: Main contract entry point
- `Account.sol`: User account management  
- `Service.sol`: Provider service registry
- `BatchVerifier.sol`: ZK proof verification

### 3. 0g-serving-user-broker (TypeScript SDK)
```
web/lib/0g-serving-user-broker/
├── src.ts/
│   ├── sdk/
│   │   ├── index.ts          # Main SDK exports
│   │   ├── broker.ts         # ZGComputeNetworkBroker class
│   │   ├── inference/        # Inference broker components
│   │   │   ├── index.ts
│   │   │   ├── broker/       # Core inference logic
│   │   │   ├── contract/     # Contract interfaces
│   │   │   └── extractor/    # Data extraction utilities
│   │   ├── ledger/           # Ledger management
│   │   │   ├── index.ts
│   │   │   ├── broker.ts
│   │   │   ├── contract/
│   │   │   └── ledger.ts
│   │   ├── fine-tuning/      # Fine-tuning capabilities
│   │   └── common/           # Shared utilities
│   ├── example/
│   │   └── inference-server.ts # OpenAI-compatible proxy example
│   └── cli/                  # Command-line interface
├── lib.commonjs/            # CommonJS build output
├── lib.esm/                 # ES modules build output
├── types/                   # TypeScript definitions
├── README.md               # SDK usage documentation
└── Interface.md            # Detailed API interface guide
```

**Key SDK Components:**
```typescript
// Main broker factory function
export async function createZGComputeNetworkBroker(
    signer: JsonRpcSigner | Wallet,
    ledgerCA?: string,
    inferenceCA?: string,
    fineTuningCA?: string
): Promise<ZGComputeNetworkBroker>

// Core broker class structure
export class ZGComputeNetworkBroker {
    public ledger!: LedgerBroker      // Account management
    public inference!: InferenceBroker // AI service interactions  
    public fineTuning?: FineTuningBroker // Model training (Wallet only)
}
```

### 4. 0g-compute-ts-starter-kit (REST API Implementation)
```
web/lib/0g-compute-ts-starter-kit/
├── src/
│   ├── config/
│   │   └── swagger.ts        # OpenAPI/Swagger configuration
│   ├── controllers/
│   │   ├── accountController.ts   # Account management endpoints
│   │   └── serviceController.ts   # AI service endpoints
│   ├── routes/  
│   │   ├── accountRoutes.ts       # Account API routes
│   │   └── serviceRoutes.ts       # Service API routes
│   ├── services/
│   │   └── brokerService.ts       # Core 0G broker integration
│   ├── index.ts             # Express app entry point
│   └── startup.ts           # Application initialization logic
├── demo-compute-flow.ts     # Complete workflow demonstration
├── DEMO_SCRIPT.md          # Demo documentation
├── package.json            # Dependencies and scripts
└── README.md               # Comprehensive setup guide
```

**API Architecture:**
```typescript
// Express app setup
const app = express();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/account', accountRoutes);
app.use('/api/services', serviceRoutes);

// Singleton broker service
export const brokerService = new BrokerService();
```

## Core Implementation Patterns

### 1. Initialization Pattern
```typescript
// Standard initialization sequence
async function initializeSDK() {
    // 1. Create ethers wallet
    const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // 2. Initialize broker with default contract addresses
    const broker = await createZGComputeNetworkBroker(wallet);
    
    // 3. Setup or check ledger account
    try {
        const ledgerInfo = await broker.ledger.getLedger();
    } catch (error) {
        await broker.ledger.addLedger(0.1); // Create with 0.1 OG
    }
    
    return broker;
}
```

### 2. Service Discovery Pattern
```typescript
// List and filter available services
async function discoverServices(broker: ZGComputeNetworkBroker) {
    const services = await broker.inference.listService();
    
    return services.map(service => ({
        provider: service.provider,
        model: service.model,
        serviceType: service.serviceType,
        url: service.url,
        inputPrice: ethers.formatEther(service.inputPrice),
        outputPrice: ethers.formatEther(service.outputPrice),
        verifiability: service.verifiability, // 'TeeML' for TEE verification
        isOfficial: OFFICIAL_PROVIDERS[service.provider] !== undefined
    }));
}
```

### 3. Query Execution Pattern
```typescript
// Complete query workflow
async function executeQuery(broker: ZGComputeNetworkBroker, providerAddress: string, query: string) {
    // 1. Acknowledge provider (required once)
    try {
        await broker.inference.acknowledgeProviderSigner(providerAddress);
    } catch (error) {
        if (!error.message.includes('already acknowledged')) throw error;
    }
    
    // 2. Get service metadata
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    
    // 3. Generate authentication headers (single-use)
    const headers = await broker.inference.getRequestHeaders(providerAddress, query);
    
    // 4. Execute OpenAI-compatible request
    const openai = new OpenAI({ baseURL: endpoint, apiKey: "" });
    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: query }],
        model
    }, { headers });
    
    // 5. Process response and handle payment
    const content = completion.choices[0].message.content;
    const chatId = completion.id;
    
    const isValid = await broker.inference.processResponse(
        providerAddress,
        content || "",
        chatId
    );
    
    return { content, isValid, chatId, model };
}
```

### 4. Error Handling Patterns
```typescript
// Comprehensive error handling
async function handleCommonErrors(operation: () => Promise<any>) {
    try {
        return await operation();
    } catch (error: any) {
        if (error.message.includes('Provider not responding')) {
            throw new Error('Provider is unavailable. Try another provider.');
        }
        
        if (error.message.includes('Insufficient balance')) {
            throw new Error('Insufficient balance. Please deposit more funds.');
        }
        
        if (error.message.includes('Headers already used')) {
            throw new Error('Authentication headers are single-use. Retrying...');
            // Headers are automatically regenerated on retry
        }
        
        if (error.message.includes('Provider not acknowledged')) {
            throw new Error('Provider must be acknowledged first.');
        }
        
        throw error; // Re-throw unexpected errors
    }
}
```

## Integration Utilities

### 1. Balance Management Utilities
```typescript
// Account and balance utilities
export class BalanceManager {
    constructor(private broker: ZGComputeNetworkBroker) {}
    
    async checkBalance(): Promise<string> {
        const ledgerInfo = await this.broker.ledger.getLedger();
        return ethers.formatEther(ledgerInfo.ledgerInfo[0]);
    }
    
    async ensureSufficientBalance(requiredAmount: number): Promise<void> {
        const currentBalance = parseFloat(await this.checkBalance());
        if (currentBalance < requiredAmount) {
            await this.broker.ledger.depositFund(requiredAmount - currentBalance + 0.01);
        }
    }
    
    async depositFunds(amount: number): Promise<string> {
        await this.broker.ledger.depositFund(amount);
        return `Deposited ${amount} OG tokens successfully`;
    }
}
```

### 2. Provider Management Utilities
```typescript
// Provider acknowledgment and metadata utilities  
export class ProviderManager {
    private acknowledgedProviders = new Set<string>();
    
    constructor(private broker: ZGComputeNetworkBroker) {}
    
    async ensureProviderAcknowledged(providerAddress: string): Promise<void> {
        if (this.acknowledgedProviders.has(providerAddress)) {
            return;
        }
        
        try {
            await this.broker.inference.acknowledgeProviderSigner(providerAddress);
            this.acknowledgedProviders.add(providerAddress);
        } catch (error: any) {
            if (error.message.includes('already acknowledged')) {
                this.acknowledgedProviders.add(providerAddress);
            } else {
                throw error;
            }
        }
    }
    
    async getProviderInfo(providerAddress: string) {
        await this.ensureProviderAcknowledged(providerAddress);
        return await this.broker.inference.getServiceMetadata(providerAddress);
    }
}
```

### 3. Request Header Utilities
```typescript
// Authentication header management
export class HeaderManager {
    constructor(private broker: ZGComputeNetworkBroker) {}
    
    async generateHeaders(providerAddress: string, content: string): Promise<Record<string, string>> {
        const headers = await this.broker.inference.getRequestHeaders(providerAddress, content);
        
        // Convert to string format for HTTP requests
        const requestHeaders: Record<string, string> = {};
        Object.entries(headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
                requestHeaders[key] = value;
            }
        });
        
        return requestHeaders;
    }
}
```

## Configuration Constants

### Network Configuration
```typescript
// Testnet configuration
export const NETWORK_CONFIG = {
    RPC_URL: "https://evmrpc-testnet.0g.ai",
    CHAIN_ID: 16600,
    FAUCET_URL: "https://faucet.0g.ai",
    
    // Default contract addresses
    LEDGER_CONTRACT: "0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa",
    INFERENCE_CONTRACT: "0x5299bd255B76305ae08d7F95B270A485c6b95D54", 
    FINE_TUNING_CONTRACT: "0xda478Ccf5d534346A16b1475E4c2DecE0268B176"
};

// Official provider addresses
export const OFFICIAL_PROVIDERS = {
    "llama-3.3-70b-instruct": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
    "deepseek-r1-70b": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3"

```

This technical guide provides the complete implementation details for integrating with the 0G Serving Network SDK components, showing the exact file structures, key utilities, and real-world usage patterns.
