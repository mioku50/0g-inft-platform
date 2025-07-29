# Communication to 0G Team: Fine-Tuning Ledger Compatibility Issue

## Subject: Critical Issue - FineTuningServing Ledger Contract Mismatch on Galileo Testnet (16601)

---

**Priority**: 🚨 **CRITICAL**  
**Network**: Galileo Testnet (Chain ID: 16601)  
**Issue Type**: Contract Configuration / Compatibility  
**Impact**: Complete fine-tuning functionality failure  

---

## Problem Summary

We are using FineTuningServing at **0xda478Ccf5d534346A16b1475E4c2DecE0268B176** on Galileo (16601), but the `addAccount` flow consistently fails. Our analysis indicates a **Ledger contract mismatch**.

## Current Configuration

```
FineTuningServing: 0xda478Ccf5d534346A16b1475E4c2DecE0268B176
Ledger (configured): 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
Provider: 0xf07240Efa67755B5311bc75784a061eDB47165Dd
```

## Error Patterns Observed

1. **Direct call to FineTuningServing**: 
   ```
   Error("Caller is not the ledger contract")
   ```

2. **Call to current Ledger**: 
   ```
   require(false) // No error message, generic revert
   ```

3. **SDK broker calls**: Various failures depending on implementation

## Root Cause Analysis

The FineTuningServing contract enforces that `addAccount` calls must come from its designated Ledger contract:
```solidity
require(msg.sender == ledgerAddress, "Caller is not the ledger contract")
```

However, the Ledger we're currently configured to use (`0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa`) either:
- Does not have the required `addAccount(address,address,string) payable` method
- Is not the correct Ledger that FineTuningServing expects
- Is not properly initialized with the FineTuningServing address

## Specific Questions for 0G Team

### 1. Correct Ledger Address
**What is the correct Ledger contract address for FineTuningServing `0xda478Ccf5d534346A16b1475E4c2DecE0268B176` on network 16601?**

You can verify this by calling:
```javascript
const serving = new ethers.Contract('0xda478Ccf5d534346A16b1475E4c2DecE0268B176', [...], provider);
const correctLedger = await serving.ledgerAddress();
```

### 2. Ledger Method Verification
**Does the correct Ledger contract have these exact methods?**
- `addAccount(address user, address provider, string memory additionalInfo) external payable`
- `depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable`

### 3. Initialization Status
**Is the Ledger contract properly initialized and linked to the FineTuningServing contract?**

## Technical Details

### Expected Architecture Flow
```
User → Ledger.addAccount(user, provider, info) + msg.value
     → Ledger forwards to FineTuningServing.addAccount(user, provider, info) + msg.value
     → FineTuningServing checks: require(msg.sender == ledgerAddress)
```

### Method Signatures (from SDK)
```solidity
// From fine_tuning_serving.go
function addAccount(address user, address provider, string additionalInfo) payable returns()
function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable returns()
```

### Current Implementation (broker.ts)
```typescript
const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable',
  'function requestRefundAll(address user, address provider) external'
]
```

## Diagnostic Scripts Available

We have created diagnostic scripts that can help verify the configuration:

### 1. Check Links Script
```bash
node web/scripts/check-links.js
```
- Compares `Serving.ledgerAddress()` with configured address
- Validates contract deployment status
- Checks provider registration

### 2. Debug Ledger Call Script
```bash
node web/scripts/debug-ledger-call.js
```
- Tests `callStatic` on `ledger.addAccount`
- Analyzes method selector presence in bytecode
- Provides detailed error analysis

**Would you like us to run these scripts and share the output with you?**

## Temporary Workaround Implemented

We have added a safety flag in `broker.ts` that:
1. Performs `callStatic` test before sending transactions
2. Shows user-friendly error message instead of cryptic failures
3. Prevents wasted gas on failed transactions

```typescript
// Safety check before transaction
try {
  await ledgerContract.addAccount.staticCall(user, provider, extraInfo, { value })
} catch (staticError) {
  if (staticError.data === '0x' || errorMsg.includes('require(false)')) {
    throw new Error('Контракт Ledger не поддерживает операции fine-tune (несоответствие версии/ABI)')
  }
}
```

## Impact & Urgency

- **Business Impact**: Fine-tuning functionality is completely broken
- **User Experience**: Users cannot create fine-tuning accounts
- **Development**: Blocking integration testing and deployment
- **Timeline**: Need resolution ASAP to meet project milestones

## Requested Response

**Immediate (within 24 hours):**
1. Correct Ledger contract address for the FineTuningServing on network 16601
2. Confirmation that the Ledger has the required methods
3. Any additional configuration or initialization steps needed

**Follow-up:**
1. Documentation update with correct contract addresses
2. Verification that our implementation approach is correct
3. Any other FineTuning-related contract addresses we should be aware of

## Contact Information

- **Project**: INFT Platform
- **Repository**: [Repository URL if applicable]
- **Network**: Galileo Testnet (16601)
- **Urgency**: Critical - blocking core functionality

## Additional Context

We are integrating the official `@0glabs/0g-serving-broker` SDK and following the documented patterns. The issue appears to be purely configuration-related rather than implementation-related, as our method signatures match the SDK expectations.

Thank you for your prompt attention to this critical issue.

---

**Attachments**:
- `LEDGER_COMPATIBILITY_REPORT.md` - Detailed technical analysis
- `web/scripts/check-links.js` - Diagnostic script for contract verification
- `web/scripts/debug-ledger-call.js` - Detailed error analysis script