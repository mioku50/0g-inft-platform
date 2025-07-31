# 🔧 ENVIRONMENT SETUP INSTRUCTIONS

## Required Environment Variables

Create a `.env.local` file in the `web/` directory with the following variables:

```bash
# 0G Network Configuration (Galileo Testnet V3)
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_0G_CHAIN_ID=16601
NEXT_PUBLIC_0G_STORAGE_URL=https://storage-testnet.0g.ai

# 0G Storage Private Key (REQUIRED for dataset uploads)
OG_STORAGE_PRIVATE_KEY=your_private_key_here

# 0G Serving Contracts (Galileo Testnet V3)
NEXT_PUBLIC_0G_SERVING_CONTRACT=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
NEXT_PUBLIC_0G_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
NEXT_PUBLIC_0G_INFERENCE_CONTRACT=0x5299bd255B76305ae08d7F95B270A485c6b95D54

# 0G Provider Address (Official)
NEXT_PUBLIC_0G_PROVIDER_ADDRESS=0xf07240Efa67755B5311bc75784a061eDB47165Dd

# Debug Configuration (Enable for troubleshooting)
NEXT_PUBLIC_DEBUG_UPLOAD=true
NEXT_PUBLIC_DEBUG_FINE_TUNE=true
```

## Critical Notes:

1. **OG_STORAGE_PRIVATE_KEY** is REQUIRED for Upload Dataset functionality
2. Replace `your_private_key_here` with your actual private key
3. All contract addresses are for Galileo Testnet V3
4. Debug flags will enable detailed console logging

## Setup Steps:

1. Copy the variables above to `web/.env.local`
2. Replace placeholder values with your actual keys
3. Restart the development server: `npm run dev`
4. Check browser console for detailed logs

