// web/app/api/mint/route.ts - обновленная версия с проверкой загрузки
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const metadata = JSON.parse(formData.get('metadata') as string)
    const address = formData.get('address') as string
    const useNewContract = formData.get('useNewContract') === 'true'
    
    console.log('Minting agent:', metadata.name)
    console.log('Use new contract:', useNewContract)
    
    // Загружаем метаданные в 0G Storage
    const { rootHash, txHash } = await uploadToStorage(
      JSON.stringify(metadata),
      `agent-${Date.now()}.json`
    )
    
    console.log('Metadata uploaded successfully:', rootHash)
    console.log('Upload tx:', txHash)
    
    // Важно: проверяем, что метаданные доступны перед минтингом
    try {
      console.log('Verifying metadata availability...')
      const verifyContent = await downloadFromStorage(rootHash)
      const verifiedMetadata = JSON.parse(verifyContent)
      
      if (verifiedMetadata.error === 'metadata_not_found') {
        console.log('Metadata not yet available, waiting...')
        await new Promise(resolve => setTimeout(resolve, 15000)) // 15 секунд
      }
    } catch (e) {
      console.warn('Could not verify metadata, continuing anyway:', e)
    }
    
    // Минтим NFT
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
    
    // ... остальной код минтинга ...
    
    return NextResponse.json({
      success: true,
      tokenId: tokenId.toString(),
      rootHash,
      uploadTx: txHash,
      transactionHash: receipt.transactionHash
    })
    
  } catch (error: any) {
    console.error('Mint error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}