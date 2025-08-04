export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { EnhancedInferenceService } from '@/lib/compute/enhanced-inference-service'
import { getPrivateKey } from '@/lib/server/compute-env'
import { isFeatureEnabled, getFeatureFlagInfo } from '@/lib/utils/feature-flags'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Inference Health Check ===')

    const enhanced = isFeatureEnabled('ENHANCED_UI')
    let healthStatus: any = {
      timestamp: new Date().toISOString(),
      enhanced,
      featureFlags: getFeatureFlagInfo()
    }

    if (enhanced) {
      const enhancedService = new EnhancedInferenceService(getPrivateKey())
      const detailedHealth = await enhancedService.getHealthStatus()
      
      healthStatus = {
        ...healthStatus,
        ...detailedHealth,
        recommendations: []
      }

      // Add recommendations based on health status
      if (detailedHealth.status === 'unhealthy') {
        healthStatus.recommendations.push('All providers are down. Check network connectivity.')
      } else if (detailedHealth.status === 'degraded') {
        healthStatus.recommendations.push('Some providers are unavailable. Performance may be affected.')
      }

      if (detailedHealth.providers.healthy < 2) {
        healthStatus.recommendations.push('Consider enabling additional providers for redundancy.')
      }

    } else {
      // Basic health check for legacy service
      healthStatus.status = 'basic'
      healthStatus.message = 'Using legacy chat service - health details not available'
    }

    console.log('Health Status:', healthStatus.status)
    console.log('Enhanced Mode:', enhanced)

    return NextResponse.json(healthStatus)

  } catch (error: any) {
    console.error('Health check error:', error)
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message,
        enhanced: isFeatureEnabled('ENHANCED_UI'),
        featureFlags: getFeatureFlagInfo()
      },
      { status: 500 }
    )
  }
}