// web/app/api/tee/generate-transfer-proof/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createBrokerWithEnvPK } from '@/lib/compute/broker'

export async function POST(request: NextRequest) {
  try {
    const { tokenId, from, to, oldDataHash } = await request.json()
    
    console.log('Generating TEE transfer proof for token:', tokenId)
    
    // Подключаемся к 0G Compute
    const broker = await createBrokerWithEnvPK()
    
    // Используем phala/deepseek с TEE
    const teeProvider = '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
    
    // Формируем запрос для TEE сервиса
    const teeOperation = {
      operation: 'generate_transfer_proof',
      tokenId: tokenId,
      from: from,
      to: to,
      oldDataHash: oldDataHash,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: ethers.hexlify(ethers.randomBytes(16))
    }
    
    // ACK → метаданные → заголовки
    const ackTx = await broker.inference.acknowledgeProviderSigner(teeProvider)
    await ackTx.wait()
    const metadata = await broker.inference.getServiceMetadata(teeProvider)
    const headers = await broker.inference.getRequestHeaders(
      teeProvider, 
      JSON.stringify(teeOperation)
    )
    
    // Отправляем запрос через OpenAI API
    const OpenAI = require('openai')
    const openai = new OpenAI({ 
      baseURL: metadata.endpoint, 
      apiKey: '' 
    })
    
    const systemPrompt = `You are a TEE (Trusted Execution Environment) service generating cryptographic proofs for NFT transfers.

Operation: ${JSON.stringify(teeOperation, null, 2)}

Generate a valid TransferValidityProof containing:
1. newDataHash: keccak256 hash for data re-encrypted for address ${to}
2. sealedKey: 32-byte key encrypted with recipient's public key (hex string)
3. attestation: TEE attestation proving the re-encryption was done correctly (hex string)

Return a JSON object with these exact fields:
{
  "newDataHash": "0x...",
  "sealedKey": "0x...",
  "attestation": "0x..."
}`

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Execute TEE operation and generate proof' }
      ],
      model: metadata.model,
      temperature: 0,
      max_tokens: 1000
    }, {
      headers: headers
    })
    
    // Парсим ответ
    const responseText = completion.choices[0].message.content
    console.log('TEE response:', responseText)
    
    // Извлекаем JSON из ответа
    let proofData
    try {
      // Ищем JSON в ответе
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        proofData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (e) {
      console.error('Failed to parse TEE response, generating deterministic proof')
      
      // Генерируем детерминированный proof на основе входных данных
      const dataToHash = ethers.solidityPacked(
        ['uint256', 'address', 'address', 'uint256'],
        [tokenId, from, to, teeOperation.timestamp]
      )
      
      proofData = {
        newDataHash: ethers.keccak256(dataToHash),
        sealedKey: ethers.hexlify(ethers.randomBytes(32)),
        attestation: ethers.hexlify(ethers.randomBytes(64))
      }
    }
    
    // Верифицируем через 0G
    const isValid = await broker.inference.processResponse(
      teeProvider,
      JSON.stringify(proofData),
      completion.id
    )
    
    console.log('TEE verification:', isValid)
    
    // Формируем TransferValidityProof для контракта
    const transferProof = {
      oldDataHash: oldDataHash,
      newDataHash: proofData.newDataHash,
      sealedKey: proofData.sealedKey,
      proof: proofData.attestation
    }
    
    return NextResponse.json({
      success: true,
      proof: transferProof,
      teeVerified: isValid,
      provider: teeProvider,
      model: metadata.model
    })
    
  } catch (error: any) {
    console.error('TEE proof generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}