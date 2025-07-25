#!/usr/bin/env tsx

import { validateFullEnvironment } from '../lib/server/compute-env'

async function main() {
  console.log('🩺 0G Compute Environment Doctor')
  console.log('==============================\n')

  try {
    const result = await validateFullEnvironment()

    if (!result.isValid) {
      console.error('❌ Environment validation failed:\n')
      result.errors.forEach(error => {
        console.error(`   • ${error}`)
      })
      console.error('')
      process.exit(1)
    }

    if (result.warnings.length > 0) {
      console.warn('⚠️  Warnings:\n')
      result.warnings.forEach(warning => {
        console.warn(`   • ${warning}`)
      })
      console.warn('')
    }

    console.log('✅ Environment validation passed!')
    
    if (result.rpcStatus) {
      console.log(`✅ RPC Connection: Chain ID ${result.rpcStatus.chainId}`)
    }
    
    if (result.walletStatus) {
      console.log(`✅ Wallet: ${result.walletStatus.address}`)
      console.log(`✅ Balance: ${result.walletStatus.balance} OG`)
    }

    console.log('\n🎉 All checks passed! Your environment is ready for 0G Compute.')

  } catch (error: any) {
    console.error('❌ Doctor script failed:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)