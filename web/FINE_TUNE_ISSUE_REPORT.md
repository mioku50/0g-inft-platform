# Fine-Tune addAccount Issue Report

## Executive Summary

The `addAccount` transaction for fine-tuning is failing with `require(false)` because there's a mismatch between the Ledger contract and FineTuningServing contract architecture.

## Root Cause Analysis

### 1. Architecture Requirements
- **FineTuningServing** (0xda478Ccf5d534346A16b1475E4c2DecE0268B176) requires that `addAccount` calls come from its designated Ledger contract
- The contract enforces this with: `require(msg.sender == ledgerAddress, "Caller is not the ledger contract")`

### 2. Current Configuration
- **Ledger Contract**: 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
- **Issue**: This Ledger contract appears to be a generic compute ledger that:
  - Does NOT have a reference to FineTuningServing
  - Does NOT forward `addAccount` calls to FineTuningServing
  - Simply reverts with `require(false)` when addAccount is called

### 3. Evidence
1. **Direct call to FineTuningServing fails**: "Caller is not the ledger contract"
2. **Call to Ledger fails**: `require(false)` with no error message
3. **Ledger has no serving reference**: No `serving()` or similar method found
4. **SDK expects the flow to work**: The @0glabs/0g-serving-broker SDK calls `broker.fineTuning.addAccount()`

## Diagnosis

The Ledger contract at 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa is NOT the correct Ledger for FineTuningServing. It's likely:
- A generic compute ledger for a different service
- Not initialized with FineTuningServing address
- Missing the forwarding logic entirely

## Recommendations

### Option 1: Find the Correct Ledger (Recommended)
Contact 0G team or check documentation for the correct FineTuning-specific Ledger address that:
- Knows about FineTuningServing at 0xda478Ccf5d534346A16b1475E4c2DecE0268B176
- Has the proper forwarding logic for addAccount calls

### Option 2: Deploy Custom Ledger
Deploy a new Ledger contract that:
1. Stores the FineTuningServing address
2. Implements forwarding logic:
   ```solidity
   function addAccount(address user, address provider, string memory info) external payable {
       IFineTuningServing(servingAddress).addAccount{value: msg.value}(user, provider, info);
   }
   ```

### Option 3: Request Contract Update
Ask the 0G team to:
- Update the existing Ledger to support FineTuningServing
- Or deploy a new FineTuning-specific Ledger
- Update documentation with the correct addresses

## Temporary Workaround

Until the correct Ledger is available, the fine-tuning functionality cannot work as the contracts enforce this specific architecture.

## Configuration to Update

Once the correct Ledger is identified, update:
```env
NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=<correct-fine-tuning-ledger-address>
```

## Scripts Created for Debugging

1. **check-links.js** - Verifies contract relationships
2. **debug-ledger-call.js** - Tests addAccount calls with detailed error reporting
3. **check-ledger-serving-link.js** - Checks if Ledger knows about FineTuningServing
4. **SDK_REQUIREMENTS_SUMMARY.md** - Documents the expected flow from SDK analysis

All evidence points to a configuration issue where the wrong Ledger contract is being used for FineTuning operations.