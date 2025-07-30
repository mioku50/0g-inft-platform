// web/app/api/compute/balance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker.server'
import { ethers } from 'ethers'

export async function GET() {
  try {
    const broker = await getBroker()
    const account = await broker.ledger.getAccount()
    
    let balance = '0'
    let balanceA0GI = 0
    
    if (account && account.ledgerInfo && account.ledgerInfo.length > 0) {
      balance = account.ledgerInfo[0].toString()
      balanceA0GI = parseFloat(ethers.formatEther(balance))
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
    
    await broker.ledger.depositFund(amount || 0.1)
    
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