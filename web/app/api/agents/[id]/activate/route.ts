import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils'
import { createRegistryService } from '@/lib/contracts/agent-model-registry'
import { ModelVersionService } from '@/lib/database/model-versions'

/**
 * POST /api/agents/:id/activate
 * Activate a delivered model version for an agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = parseInt(params.id)
    const body = await request.json()
    const { modelRootHash, userAddress, consentSignature } = body

    if (!modelRootHash) {
      return NextResponse.json({ error: 'Model root hash is required' }, { status: 400 })
    }

    if (!userAddress) {
      return NextResponse.json({ error: 'User address is required' }, { status: 400 })
    }

    // Validate that the model exists and is a candidate
    const modelVersion = await ModelVersionService.getModelByRootHash(modelRootHash)
    if (!modelVersion) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    if (modelVersion.agentId !== agentId) {
      return NextResponse.json({ error: 'Model does not belong to this agent' }, { status: 400 })
    }

    if (modelVersion.status !== 'candidate') {
      return NextResponse.json({ error: 'Model is not a candidate for activation' }, { status: 400 })
    }

    // Check required environment variables
    if (!process.env.OG_COMPUTE_PRIVATE_KEY || !process.env.NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS) {
      return NextResponse.json({ 
        error: 'Registry contract not configured',
        details: 'Missing OG_COMPUTE_PRIVATE_KEY or NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS'
      }, { status: 503 })
    }

    // Record consent if signature provided
    let consentTxHash = ''
    if (consentSignature) {
      try {
        const registryService = createRegistryService(
          process.env.NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS,
          process.env.OG_COMPUTE_PRIVATE_KEY,
          process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
        )

        // Create signature hash
        const consentHash = keccak256(toUtf8Bytes(consentSignature))

        // Record consent on-chain
        consentTxHash = await registryService.recordConsent({
          tokenId: agentId,
          user: userAddress,
          consentType: 'activate',
          signatureHash: consentHash
        })

        // Record consent in database
        await ModelVersionService.recordConsent({
          agentId,
          userAddress,
          consentType: 'activate',
          payloadJson: { 
            modelRootHash,
            action: 'activate',
            timestamp: new Date().toISOString()
          },
          signature: consentSignature,
          signatureHash: consentHash
        })

        console.log('Consent recorded on-chain:', consentTxHash)
      } catch (consentError) {
        console.error('Failed to record consent:', consentError)
        // Continue without failing the activation
      }
    }

    // Activate model on-chain using platform service key
    try {
      const registryService = createRegistryService(
        process.env.NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS,
        process.env.OG_COMPUTE_PRIVATE_KEY,
        process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
      )

      const result = await registryService.setActiveModel(agentId, modelRootHash)

      // Update database - activate this model and archive others
      await ModelVersionService.activateModel(agentId, modelRootHash)

      console.log('Model activated on-chain:', result.txHash)

      return NextResponse.json({
        success: true,
        txHash: result.txHash,
        activeModelRoot: modelRootHash,
        consentTxHash: consentTxHash || undefined,
        message: 'Model activated successfully',
        viewOnChainUrl: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        event: result.event
      })

    } catch (activationError: any) {
      console.error('Failed to activate model on-chain:', activationError)
      return NextResponse.json({
        error: 'Failed to activate model on-chain',
        details: activationError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Failed to activate model:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to activate model',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/:id/activate
 * Get activation status and candidate models for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = parseInt(params.id)

    // Get current active model
    const activeModel = await ModelVersionService.getActiveModel(agentId)
    
    // Get candidate models
    const candidateModels = await ModelVersionService.getCandidateModels(agentId)

    // Get model statistics
    const stats = await ModelVersionService.getModelStats(agentId)

    return NextResponse.json({
      success: true,
      agentId,
      activeModel,
      candidateModels,
      stats
    })

  } catch (error: any) {
    console.error('Failed to get activation status:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get activation status',
        success: false
      },
      { status: 500 }
    )
  }
}