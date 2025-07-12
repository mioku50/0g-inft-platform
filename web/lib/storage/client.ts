// lib/storage/client.ts - Обновленный для ethers v6
import { Indexer, ZgFile, getFlowContract } from '@0glabs/0g-ts-sdk'
import { ethers } from 'ethers'
import crypto from 'crypto'

interface StorageResult {
  encryptedURI: string
  metadataHash: string
}

// Инициализация для 0G Storage
const evmRpc = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
const flowAddress = process.env.NEXT_PUBLIC_0G_FLOW_ADDRESS || '0xbD2C3F0E65eDF5582141C35969d66e34629cC768'

export async function uploadToStorage(
  metadata: any,
  ownerAddress: string,
  privateKey: string
): Promise<StorageResult> {
  try {
    // 1. Подготавливаем данные
    const metadataString = JSON.stringify(metadata)
    const metadataHash = ethers.keccak256(
      ethers.toUtf8Bytes(metadataString)
    )
    
    // 2. Простое шифрование для демо
    const encryptionKey = crypto.randomBytes(32).toString('hex')
    const encrypted = Buffer.from(metadataString).toString('base64')
    
    // 3. Создаем временный файл для загрузки
    const tempFileName = `/tmp/agent-${Date.now()}.json`
    const fs = require('fs').promises
    await fs.writeFile(tempFileName, encrypted)
    
    // 4. Создаем ZgFile из файла
    const file = await ZgFile.fromFilePath(tempFileName)
    
    // 5. Создаем Merkle tree
    const [tree, treeErr] = await file.merkleTree()
    if (treeErr !== null) {
      throw new Error(`Failed to create merkle tree: ${treeErr}`)
    }
    
    // 6. Инициализируем провайдера и signer (ethers v6)
    const provider = new ethers.JsonRpcProvider(evmRpc)
    const signer = new ethers.Wallet(privateKey, provider)
    
    // 7. Создаем Indexer
    const indexer = new Indexer(indexerRpc)
    
    // 8. Загружаем файл в 0G Storage
    const [tx, uploadErr] = await indexer.upload(file, evmRpc, signer)
    if (uploadErr !== null) {
      throw new Error(`Upload failed: ${uploadErr}`)
    }
    
    console.log('File uploaded successfully, tx:', tx)
    
    // 9. Получаем root hash
    const rootHash = tree!.rootHash()
    
    // 10. Закрываем файл и удаляем временный
    await file.close()
    await fs.unlink(tempFileName)
    
    return {
      encryptedURI: `0g://storage/${rootHash}`,
      metadataHash
    }
  } catch (error) {
    console.error('0G Storage upload error:', error)
    throw new Error(`Failed to upload to 0G Storage: ${error.message}`)
  }
}

export async function retrieveFromStorage(
  encryptedURI: string,
  ownerAddress: string
): Promise<any> {
  try {
    // 1. Извлекаем root hash из URI
    const rootHash = encryptedURI.replace('0g://storage/', '')
    
    // 2. Создаем Indexer
    const indexer = new Indexer(indexerRpc)
    
    // 3. Скачиваем файл
    const outputPath = `/tmp/download-${Date.now()}.json`
    const downloadErr = await indexer.download(rootHash, outputPath, true)
    
    if (downloadErr !== null) {
      throw new Error(`Download failed: ${downloadErr}`)
    }
    
    // 4. Читаем скачанный файл
    const fs = require('fs').promises
    const encryptedData = await fs.readFile(outputPath, 'utf-8')
    
    // 5. Расшифровываем
    const decrypted = Buffer.from(encryptedData, 'base64').toString('utf-8')
    
    // 6. Удаляем временный файл
    await fs.unlink(outputPath)
    
    return JSON.parse(decrypted)
  } catch (error) {
    console.error('0G Storage retrieval error:', error)
    throw new Error(`Failed to retrieve from 0G Storage: ${error.message}`)
  }
}

// Функция для загрузки изображений
export async function uploadImage(imageFile: File, privateKey: string): Promise<string> {
  try {
    // Конвертируем File в путь
    const tempPath = `/tmp/image-${Date.now()}-${imageFile.name}`
    
    // В браузере используем другой подход
    if (typeof window !== 'undefined') {
      // Для браузера создаем Blob
      const { Blob } = await import('@0glabs/0g-ts-sdk/browser')
      const blob = new Blob(imageFile)
      
      const [tree, treeErr] = await blob.merkleTree()
      if (treeErr !== null) {
        throw new Error(`Failed to create merkle tree: ${treeErr}`)
      }
      
      // Используем BrowserProvider для MetaMask (ethers v6)
      const { BrowserProvider } = ethers
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      const indexer = new Indexer(indexerRpc)
      const [tx, uploadErr] = await indexer.upload(blob, evmRpc, signer)
      
      if (uploadErr !== null) {
        throw new Error(`Upload failed: ${uploadErr}`)
      }
      
      return `0g://storage/${tree!.rootHash()}`
    }
    
    // Для Node.js окружения
    const buffer = await imageFile.arrayBuffer()
    const fs = require('fs').promises
    await fs.writeFile(tempPath, Buffer.from(buffer))
    
    const file = await ZgFile.fromFilePath(tempPath)
    const [tree, treeErr] = await file.merkleTree()
    
    if (treeErr !== null) {
      throw new Error(`Failed to create merkle tree: ${treeErr}`)
    }
    
    const provider = new ethers.JsonRpcProvider(evmRpc)
    const signer = new ethers.Wallet(privateKey, provider)
    
    const indexer = new Indexer(indexerRpc)
    const [tx, uploadErr] = await indexer.upload(file, evmRpc, signer)
    
    if (uploadErr !== null) {
      throw new Error(`Upload failed: ${uploadErr}`)
    }
    
    await file.close()
    await fs.unlink(tempPath)
    
    return `0g://storage/${tree!.rootHash()}`
  } catch (error) {
    console.error('Image upload error:', error)
    throw new Error(`Failed to upload image: ${error.message}`)
  }
}