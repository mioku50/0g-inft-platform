import { testContract } from '../../test-contract-services'

export async function GET() {
  try {
    console.log('🔍 Starting InferenceServing contract test...')
    const result = await testContract()
    
    return Response.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Contract test failed:', error)
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}