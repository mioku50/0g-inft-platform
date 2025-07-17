// web/app/api/tee/generate-clone-proof/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

export async function POST(request: NextRequest) {
  try {
    const { tokenId, owner, cloneName, cloneDescription } = await request.json()
    
    console.log('Generating clone proof for:', { tokenId, owner })
    
    // Кодируем данные для proof
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    
    // Структура proof для клонирования
    const proofData = {
      tokenId: BigInt(tokenId),
      owner: owner,
      timestamp: Math.floor(Date.now() / 1000),
      metadataHash: ethers.keccak256(ethers.toUtf8Bytes(cloneName + cloneDescription))
    }
    
    // Кодируем proof
    const encodedData = abiCoder.encode(
      ['uint256', 'address', 'uint256', 'bytes32'],
      [proofData.tokenId, proofData.owner, proofData.timestamp, proofData.metadataHash]
    )
    
    const proof = encodedData
    
    return NextResponse.json({
      success: true,
      proof: proof
    })
    
  } catch (error: any) {
    console.error('Clone proof generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}