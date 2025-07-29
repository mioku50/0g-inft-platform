# Fine-Tuning Diagnostic Scripts

This directory contains diagnostic scripts to troubleshoot fine-tuning Ledger compatibility issues.

## Prerequisites

1. **Environment Setup**: Ensure `.env.local` contains:
   ```env
   NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
   NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
   NEXT_PUBLIC_FINE_TUNE_PROVIDER=0xf07240Efa67755B5311bc75784a061eDB47165Dd
   NEXT_PUBLIC_OG_RPC=https://evmrpc-testnet.0g.ai
   OG_COMPUTE_PRIVATE_KEY=your_private_key_here
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install ethers dotenv
   ```

## Scripts

### 1. check-links.js
**Purpose**: Verify contract relationships and configuration

**Usage**:
```bash
node web/scripts/check-links.js
```

**What it checks**:
- ✅ Contract deployment status
- ✅ `Serving.ledgerAddress()` vs `NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT` match
- ✅ Provider service registration and availability
- ✅ Network connectivity

**Expected Output**:
```
🔗 Checking contract links and configuration...

📡 Connected to network: Chain ID 16601
🏗️  Contract Addresses:
   FineTuningServing: 0xda478Ccf5d534346A16b1475E4c2DecE0268B176
   Ledger (env):      0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
   Provider:          0xf07240Efa67755B5311bc75784a061eDB47165Dd

✅ FineTuningServing contract is deployed
✅ Ledger contract is deployed

🔍 Ledger Address Verification:
   From Serving.ledgerAddress(): 0x...
   From .env (COMPUTE_LEDGER):   0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
   
❌ ADDRESS MISMATCH! This is the root cause of the issue.
```

### 2. debug-ledger-call.js
**Purpose**: Test `addAccount` method compatibility with detailed error analysis

**Usage**:
```bash
node web/scripts/debug-ledger-call.js
```

**What it tests**:
- 🧪 `callStatic` on `ledger.addAccount`
- ⛽ `estimateGas` for the method
- 🔍 Method selector presence in bytecode
- 📊 Error pattern analysis

**Expected Output**:
```
🐛 Debug Ledger Call - Testing addAccount functionality

📡 Connected to network: Chain ID 16601
👤 Using address: 0x...
🏗️  Ledger contract: 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
🤖 Provider: 0xf07240Efa67755B5311bc75784a061eDB47165Dd

🔍 Analyzing contract at 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa...
✅ Contract deployed (12345 bytes)
❌ Method selector 0xe50688f9 NOT found in bytecode
   💡 This suggests addAccount(address,address,string) does not exist

🧪 Testing callStatic for addAccount...
❌ callStatic failed: execution reverted
   Error data: 0x
   📊 Analysis: Generic revert without reason (likely require(false))
```

## Troubleshooting

### Common Issues

1. **"Contract not deployed"**
   - Check RPC URL is correct
   - Verify contract addresses in `.env.local`
   - Ensure you're on the right network (16601)

2. **"Private key not set"**
   - Add `OG_COMPUTE_PRIVATE_KEY` to `.env.local`
   - Remove `0x` prefix from private key

3. **"Network connection failed"**
   - Check internet connection
   - Verify RPC endpoint is accessible
   - Try alternative RPC: `https://evmrpc-testnet.0g.ai`

### Expected Results

If everything is working correctly:
- ✅ Both scripts should show all green checkmarks
- ✅ Ledger addresses should match
- ✅ `callStatic` should succeed

If there's a configuration issue:
- ❌ Address mismatch in `check-links.js`
- ❌ `callStatic` failures in `debug-ledger-call.js`
- 🚨 Clear error messages indicating the problem

## Next Steps

1. **Run both scripts** and save the output
2. **Share results** with 0G team using `0G_TEAM_COMMUNICATION.md`
3. **Wait for correct Ledger address** from 0G team
4. **Update configuration** with correct address
5. **Re-run scripts** to verify fix

## Files Generated

- `LEDGER_COMPATIBILITY_REPORT.md` - Technical analysis
- `0G_TEAM_COMMUNICATION.md` - Structured communication for 0G team

## Support

If you encounter issues with the scripts themselves:
1. Check Node.js version (>=16 required)
2. Verify all dependencies are installed
3. Ensure `.env.local` file exists and is properly formatted
4. Check console for detailed error messages