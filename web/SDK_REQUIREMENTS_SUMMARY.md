# SDK Requirements Summary for Fine-Tuning Flow

## Key Findings

### 1. Contract Architecture
- **FineTuningServing** (0xda478Ccf5d534346A16b1475E4c2DecE0268B176) - главный контракт сервиса
- **Ledger** (0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa) - контракт для управления балансами
- FineTuningServing.ledgerAddress() → указывает на Ledger контракт ✅

### 2. Method Call Sequence

#### addAccount Flow:
```
Client → Ledger.addAccount(user, provider, additionalInfo) 
         ↓ (internal call)
         Ledger → FineTuningServing.addAccount(user, provider, additionalInfo)
```

**Evidence:**
- web/scripts/test-fine-tune-flow.js:línea ~200 - Error: "Caller is not the ledger contract"
- web/tmp/fine-tuning/contract/fine_tuning_serving.go:658 - addAccount method signature

#### Key Requirements:
1. **addAccount MUST be called via Ledger contract**, not directly on FineTuningServing
2. Provider must be registered (getService returns valid data) ✅
3. Account must not exist already ✅
4. Provider Signer acknowledgment may be required (0x0000000000000000000000000000000000111111)

### 3. Current Issue
Transaction reverts with `require(false)` when calling Ledger.addAccount, suggesting:
- Ledger contract might not be properly initialized with FineTuningServing address
- OR there's an additional pre-condition not being met

### 4. Method Signatures (confirmed from ABI)
```solidity
// Ledger contract
function addAccount(address user, address provider, string memory additionalInfo) external payable

// FineTuningServing contract  
function addAccount(address user, address provider, string additionalInfo) payable
function acknowledgeProviderSigner(address provider, address providerSigner)
```

## Updated Analysis

### Problem Diagnosis:
1. **Ledger contract (0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa) does NOT know about FineTuningServing**
   - No `serving()` or similar method found
   - Appears to be a generic compute ledger, not FineTuning-specific

2. **FineTuningServing expects calls from its designated Ledger**
   - Rejects direct calls with "Caller is not the ledger contract"
   - Has internal check: `msg.sender == ledgerAddress`

3. **Current Ledger reverts with `require(false)`**
   - Likely because it doesn't have the logic to forward calls to FineTuningServing
   - Or it's checking some other condition that fails

## Recommendations

### Option 1: Find the correct Ledger contract
- There might be a FineTuning-specific Ledger deployed that knows about FineTuningServing
- Check with 0G team or documentation for the correct address

### Option 2: Use the 0G SDK broker pattern
- The @0glabs/0g-serving-broker SDK might handle this complexity internally
- It might use a different entry point or contract

### Option 3: Deploy a new Ledger
- Deploy a FineTuning-aware Ledger that can forward calls to FineTuningServing
- This Ledger would need to be initialized with the FineTuningServing address

## Артефакт: Краткая выжимка (подтверждение требований SDK)

**Последовательность вызовов подтверждена:**
1. Client → Ledger.addAccount() ✅ (требуется по архитектуре)
2. Ledger → FineTuningServing.addAccount() ❌ (Ledger не знает о FineTuningServing)

**Ссылки на строки:**
- web/tmp/fine-tuning/contract/fine_tuning_serving.go:93-94 - ABI с методами addAccount
- web/scripts/check-ledger-serving-link.js:46-60 - проверка отсутствия связи Ledger→Serving
- web/scripts/debug-ledger-call.js:123-124 - подтверждение revert с require(false)
- web/lib/compute/broker.ts:361-362 - текущий вызов через Ledger

**Вывод:** Путь «клиент → Ledger.addAccount → Serving.addAccount» корректен согласно SDK, но текущий Ledger (0x1a85Dd32...) не настроен для работы с FineTuningServing. Требуется правильный Ledger контракт.