# Fine-tune Deposit Fund Error Fix

## Problem
The error "value must be a string" was occurring when trying to deposit funds using the 0G SDK broker's `depositFund` method.

## Root Cause
The SDK broker's `fineTuning.depositFund` method appears to have compatibility issues with the custom contract addresses being used in the project. The SDK might be expecting different parameter types or a different method signature than what's being provided.

## Solution
Instead of using the SDK broker's method, we now use direct contract calls to the Ledger contract, which is consistent with how the test files and CLI implementation work.

## Changes Made

### 1. Modified `deposit` function in `web/lib/compute/broker.ts`

**Before:**
```typescript
const tx = await broker.fineTuning.depositFund(
  user,
  provider,
  0n, // cancelRetrievingAmount
  { value }
)
```

**After:**
```typescript
// Use direct contract call instead of SDK broker due to compatibility issues
const ledgerContract = new ethers.Contract(ledger, LEDGER_ABI, signer)

const tx = await ledgerContract.depositFund(
  user,
  provider,
  0n, // cancelRetrievingAmount
  { value }
)
```

## Benefits
1. **Direct control**: Using direct contract calls gives us more control over the transaction parameters
2. **Consistency**: This approach is consistent with the test files and proven to work
3. **Compatibility**: Avoids potential compatibility issues with the SDK broker when using custom contract addresses

## Testing
The fix should resolve the "value must be a string" error when depositing funds through the fine-tune interface. The deposit operation should now complete successfully.

## Next Steps
1. Test the deposit functionality through the UI
2. Consider updating other SDK broker calls to use direct contracts if similar issues arise
3. Monitor for any side effects of bypassing the SDK broker