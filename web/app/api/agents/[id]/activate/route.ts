import { NextRequest, NextResponse } from 'next/server'
import { validateComputeEnvironment } from '@/lib/server/compute-env'
import AgentModelRegistryService from '@/lib/contracts/agent-model-registry'
import { db, activateModelVersion } from '@/database/connection'

export const runtime = 'nodejs'

/**
 * POST /api/agents/[id]/activate
 * Activate a candidate model version for an agent
 * Platform pays gas for on-chain activation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    return NextResponse.json({
      error: 'Compute environment misconfigured',
      details: envValidation.errors
    }, { status: 503 })
  }

  try {
    const agentId = parseInt(params.id)
    const body = await request.json()
    const { modelRootHash, userAddress, consentSignature } = body

    if (!modelRootHash || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: modelRootHash, userAddress' },
        { status: 400 }
      )
    }

    console.log(`🔄 Activating model for agent ${agentId}...`)

    // Validate that the model is a delivered candidate
    const modelVersion = await db.getModelVersionByHash(modelRootHash)
    if (!modelVersion || modelVersion.agentId !== agentId || modelVersion.status !== 'candidate') {
      return NextResponse.json(
        { error: 'Model not found or not a candidate for activation' },
        { status: 400 }
      )
    }

    // Optional: Store consent signature if provided
    if (consentSignature) {
      try {
        await db.createConsent({
          agentId,
          userAddress,
          consentType: 'activate',
          payloadJson: JSON.stringify({
            agentId,
            modelRootHash,
            timestamp: Date.now()
          }),
          signature: consentSignature.signature,
          signatureHash: consentSignature.hash
        })
        console.log('✅ Consent signature stored')
      } catch (error) {
        console.warn('Failed to store consent signature:', error)
      }
    }

    // Step 1: Set active model on-chain (platform pays gas)
    const txHashActivated = await AgentModelRegistryService.setActiveModel(
      agentId,
      modelRootHash,
      userAddress
    )

    console.log(`✅ Model activated on-chain: ${txHashActivated}`)

    // Step 2: Update database
    const updatedVersion = await activateModelVersion(agentId, modelRootHash, txHashActivated)
    
    if (!updatedVersion) {
      throw new Error('Failed to update model version in database')
    }

    console.log(`✅ Database updated - model activated`)

    return NextResponse.json({
      success: true,
      modelRootHash,
      txHashActivated,
      chainLink: AgentModelRegistryService.getChainLink(txHashActivated),
      message: 'Model activated successfully',
      version: {
        id: updatedVersion.id,
        status: updatedVersion.status,
        activatedAt: updatedVersion.activatedAt?.toISOString()
      }
    })

  } catch (error: any) {
    console.error('Failed to activate model:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to activate model' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/[id]/activate
 * Get agent model information (active and candidate models)
 * Respects ENABLE_FINE_TUNE feature flag
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = parseInt(params.id)
    
    // Check if fine-tune is disabled
    if (process.env.ENABLE_FINE_TUNE !== 'true') {
      console.log(`[Fine-tune] GET agents/${agentId}/activate skipped - feature disabled`)
      return NextResponse.json({
        success: true,
        agentId,
        summary: {
          activeModel: null,
          candidateModel: null,
          totalVersions: 0
        },
        onChain: {
          activeModel: null,
          candidateModel: null
        },
        featureDisabled: true
      })
    }
    
    // Get model summary from database
    const summary = await db.getAgentModelSummary(agentId)
    
    // Get on-chain information (only if feature is enabled)
    const activeModelOnChain = await AgentModelRegistryService.getActiveModel(agentId)
    const candidateOnChain = await AgentModelRegistryService.getCandidateModel(agentId)

    return NextResponse.json({
      success: true,
      agentId,
      summary,
      onChain: {
        activeModel: activeModelOnChain,
        candidateModel: candidateOnChain
      }
    })

  } catch (error: any) {
    console.error('Failed to get agent model info:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get model info' },
      { status: 500 }
    )
  }
}