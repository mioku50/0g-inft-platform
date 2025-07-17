// web/app/api/tee/re-encrypt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { originalData, oldOwner, newOwner, tokenId } = await request.json()
    
    console.log('TEE Re-encryption request for token:', tokenId)
    
    // В реальной реализации это должно выполняться в TEE
    // Здесь симулируем процесс перешифровки
    
    // 1. Генерируем новый ключ шифрования для нового владельца
    const newEncryptionKey = crypto.randomBytes(32).toString('hex')
    
    // 2. Перешифровываем данные новым ключом
    const cipher = crypto.createCipher('aes-256-cbc', newEncryptionKey)
    let encrypted = cipher.update(JSON.stringify(originalData), 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // 3. Шифруем ключ публичным ключом получателя
    // В реальной реализации используется публичный ключ получателя
    const encryptedKey = ethers.hexlify(ethers.toUtf8Bytes(
      `ENCRYPTED_FOR_${newOwner}_KEY_${newEncryptionKey.substring(0, 8)}`
    ))
    
    // 4. Генерируем proof для контракта
    const proof = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'bytes32'],
        [oldOwner, newOwner, tokenId, ethers.id(encrypted)]
      )
    )
    
    // 5. Сохраняем новые зашифрованные данные
    const newMetadataHash = ethers.keccak256(ethers.toUtf8Bytes(encrypted))
    
    return NextResponse.json({
      success: true,
      newMetadataHash,
      encryptedKey,
      proof,
      teeSignature: 'TEE_SIGNATURE_PLACEHOLDER' // В реальной реализации - подпись TEE
    })
    
  } catch (error: any) {
    console.error('TEE re-encryption error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}