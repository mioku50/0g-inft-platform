import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { checkStorageHealth } from '@/lib/storage/client-server';

const L1_RPC = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai';
const STORAGE_KEY = process.env.OG_STORAGE_PRIVATE_KEY;
const COMPUTE_KEY = process.env.OG_COMPUTE_PRIVATE_KEY;

export async function GET(request: NextRequest) {
  try {
    const provider = new ethers.JsonRpcProvider(L1_RPC);
    
    // Check storage wallet
    let storageWallet = null;
    let storageBalance = '0';
    if (STORAGE_KEY) {
      storageWallet = new ethers.Wallet(STORAGE_KEY, provider);
      const balance = await provider.getBalance(storageWallet.address);
      storageBalance = ethers.formatEther(balance);
    }
    
    // Check compute wallet
    let computeWallet = null;
    let computeBalance = '0';
    if (COMPUTE_KEY) {
      computeWallet = new ethers.Wallet(COMPUTE_KEY, provider);
      const balance = await provider.getBalance(computeWallet.address);
      computeBalance = ethers.formatEther(balance);
    }
    
    // Check storage health
    const storageHealth = await checkStorageHealth();
    
    // Get current block for network check
    const blockNumber = await provider.getBlockNumber();
    
    return NextResponse.json({
      success: true,
      network: {
        rpc: L1_RPC,
        blockNumber,
        connected: true
      },
      wallets: {
        storage: {
          configured: !!STORAGE_KEY,
          address: storageWallet?.address || 'Not configured',
          balance: storageBalance + ' ETH',
          sufficient: parseFloat(storageBalance) >= 0.1
        },
        compute: {
          configured: !!COMPUTE_KEY,
          address: computeWallet?.address || 'Not configured',
          balance: computeBalance + ' ETH',
          sufficient: parseFloat(computeBalance) >= 0.1
        }
      },
      storage: storageHealth
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}