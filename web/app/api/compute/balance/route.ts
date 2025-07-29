// web/app/api/compute/balance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker'
import { ethers, parseEther, formatEther } from 'ethers'

export async function GET() {
  try {
    const broker = await getBroker()
    const account = await broker.ledger.getLedger ? await broker.ledger.getLedger() : await broker.ledger.getAccount()
    
    let balance = '0'
    let balanceA0GI = 0
    
    if (account) {
      if (account.balance !== undefined) {
        balance = typeof account.balance === 'bigint' ? formatEther(account.balance) : formatEther(BigInt(account.balance))
      } else if (account.AvailableBalance !== undefined) {
        balance = typeof account.AvailableBalance === 'bigint' ? formatEther(account.AvailableBalance) : formatEther(BigInt(account.AvailableBalance))
      } else if (account.ledgerInfo) {
        balance = formatEther(account.ledgerInfo[0])
      } else if (Array.isArray(account)) {
        balance = formatEther(account[0])
      }
      balanceA0GI = parseFloat(balance)
    }
    
    return NextResponse.json({
      success: true,
      account,
      balance: balance,
      balanceA0GI: balanceA0GI,
      sufficient: balanceA0GI >= 0.01
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()
    const broker = await getBroker()
    const wei = parseEther(String(amount || 0.1))
    await broker.ledger.depositFund(wei)
    
    return NextResponse.json({
      success: true,
      message: `Deposited ${amount || 0.1} A0GI`
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}