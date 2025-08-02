# Provider Preflight Health Check Fix

## Issue Description

The fine-tuning system was incorrectly marking providers as unavailable when they returned 404 errors on the non-standard `/v1/quote/health` endpoint. This prevented users from starting fine-tuning tasks even when the provider was functional.

## Problem Analysis

1. **Incorrect Health Check Endpoint**: The system was checking `/v1/quote/health` which is not part of the 0G Fine-tuning Provider specification
2. **Wrong Task Creation Endpoint**: Using `/v1/user/{userAddress}/fine-tuning/task` instead of the correct `/v1/user/{userAddress}/task`
3. **Poor Error Handling**: 404 responses were treated as provider unavailability rather than unsupported endpoints
4. **No Fallback Strategy**: No alternative health check methods when primary endpoint failed

## Solution Implemented

### 1. Fixed Preflight Health Check Logic

**Before:**
```typescript
const healthUrl = `${providerUrl}/v1/quote/health`
const healthResponse = await fetch(healthUrl, { method: 'GET' })

if (!healthResponse.ok) {
  return NextResponse.json({
    error: 'Provider unavailable, try later'
  }, { status: 503 })
}
```

**After:**
```typescript
// Primary: GET /v1/quote (as per 0G spec)
const quoteUrl = `${providerUrl}/v1/quote`
const quoteResponse = await fetch(quoteUrl, { method: 'GET' })

if (quoteResponse.ok) {
  console.log('✅ Provider preflight check passed via /v1/quote')
  preflightPassed = true
} else {
  // Try fallback endpoints: /health, /status
  for (const endpoint of ['/health', '/status']) {
    const fallbackResponse = await fetch(`${providerUrl}${endpoint}`)
    if (fallbackResponse.ok) {
      preflightPassed = true
      break
    }
  }
  
  // Final basic connectivity test
  if (!preflightPassed) {
    const basicResponse = await fetch(providerUrl)
    // Any HTTP response (even 404) means server is reachable
    console.log('Provider reachable but health endpoints not supported')
  }
}
```

### 2. Fixed Task Creation Endpoint

**Before:**
```typescript
const createTaskUrl = `${providerUrl}/v1/user/${userAddress}/fine-tuning/task`
```

**After:**
```typescript
const createTaskUrl = `${providerUrl}/v1/user/${userAddress}/task`
```

### 3. Improved Error Messages

- **404 on health endpoints**: No longer blocks task creation
- **Network timeouts**: Clear "Provider unavailable (timeout/network error)" message
- **5xx errors**: Specific "Provider unavailable (timeout/5xx)" message  
- **Successful fallback**: Shows which endpoint method worked

### 4. Provider Configuration

- Confirmed provider `0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f` maps to `http://50.145.48.68:30080`
- Maintained whitelist validation for allowed providers
- Preserved Galileo Testnet v3 configuration (chainId: 16601)

## API Endpoints According to 0G Specification

### Health Check Priority Order
1. `GET /v1/quote` (primary) → expects 200 OK with string response
2. `GET /health` (fallback) → standard health check endpoint
3. `GET /status` (fallback) → alternative status endpoint  
4. Basic connectivity test → any HTTP response indicates reachable server

### Task Management
- **Create task**: `POST /v1/user/{userAddress}/task`
- **Get task status**: `GET /v1/user/{userAddress}/task/{taskId}`
- **Cancel task**: `POST /v1/user/{userAddress}/task/{taskId}/cancel`
- **Get logs**: `GET /v1/user/{userAddress}/task/{taskId}/log`

## Expected User Experience After Fix

### Before Fix
1. User clicks "Start Fine-tuning"
2. System checks `/v1/quote/health` → gets 404
3. Shows "Provider unavailable, try later" banner
4. Fine-tuning blocked

### After Fix
1. User clicks "Start Fine-tuning"  
2. System checks `/v1/quote` → may get 404, tries fallbacks
3. Fallback checks succeed or basic connectivity confirms server reachable
4. System proceeds with task creation on correct endpoint
5. Fine-tuning starts successfully

## Files Modified

1. **`/web/app/api/compute/fine-tune/route.ts`**
   - Updated preflight health check logic (lines 270-332)
   - Added fallback endpoint strategy
   - Improved error messages and status codes

2. **`/web/lib/compute/broker.ts`**
   - Fixed task creation endpoint (line 295)
   - Changed from `/fine-tuning/task` to `/task`

## Testing

To verify the fix works:

1. **Test with working provider**: Should use `/v1/quote` or fallback successfully
2. **Test with unresponsive provider**: Should show proper timeout error
3. **Test task creation**: Should use correct `/v1/user/{user}/task` endpoint
4. **Test error messages**: Should distinguish between network and HTTP errors

## Configuration Validation

Ensure your environment has:
```env
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_0G_CHAIN_ID=16601
NEXT_PUBLIC_FINE_TUNE_PROVIDER=0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f
```

## Monitoring

Check logs for these success indicators:
- `✅ Provider preflight completed successfully via /v1/quote`
- `✅ Provider preflight completed successfully via /health`  
- `ℹ️ Provider reachable but health endpoints not supported, continuing`

## Impact

- **No more false "Provider unavailable" errors** for 404 responses on health checks
- **Correct API compliance** with 0G Fine-tuning Provider specification
- **Better user experience** with clear error messages
- **Improved reliability** with fallback health check strategy

The fine-tuning system now properly follows the 0G specification and provides a better user experience while maintaining proper error handling for genuinely unavailable providers.