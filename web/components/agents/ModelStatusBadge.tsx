// components/agents/ModelStatusBadge.tsx
// Component to display model status on agent cards

'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Sparkles, 
  Zap, 
  Clock, 
  CheckCircle,
  ExternalLink
} from 'lucide-react'
import { useAgentModelInfo } from '@/hooks/useAgentModelInfo'
import { toast } from '@/hooks/use-toast'

interface ModelStatusBadgeProps {
  agentId: number
  compact?: boolean
  onActivateModel?: (agentId: number, modelRootHash: string) => void
}

export function ModelStatusBadge({ 
  agentId, 
  compact = false,
  onActivateModel 
}: ModelStatusBadgeProps) {
  const { modelInfo, loading } = useAgentModelInfo(agentId)

  if (loading) {
    return (
      <div className="flex items-center space-x-1">
        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (!modelInfo) {
    return null
  }

  const handleMakeActive = () => {
    if (modelInfo.candidateModelRoot && onActivateModel) {
      onActivateModel(agentId, modelInfo.candidateModelRoot)
    }
  }

  if (compact) {
    // Compact badges for agent cards
    return (
      <div className="flex items-center space-x-1">
        {modelInfo.hasActiveModel && (
          <Badge 
            variant="secondary" 
            className="bg-green-500/20 text-green-700 border-green-500/30 text-xs"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Active v{modelInfo.totalVersions > 0 ? modelInfo.totalVersions : 1}
          </Badge>
        )}
        
        {modelInfo.hasCandidate && (
          <Badge 
            variant="secondary" 
            className="bg-orange-500/20 text-orange-700 border-orange-500/30 text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Candidate
          </Badge>
        )}
        
        {modelInfo.isTraining && (
          <Badge 
            variant="secondary" 
            className="bg-purple-500/20 text-purple-700 border-purple-500/30 text-xs"
          >
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Training
          </Badge>
        )}
        
        {!modelInfo.hasActiveModel && !modelInfo.hasCandidate && !modelInfo.isTraining && (
          <Badge 
            variant="outline" 
            className="border-gray-300 text-gray-500 text-xs"
          >
            No Models
          </Badge>
        )}
      </div>
    )
  }

  // Detailed view for other uses
  return (
    <div className="space-y-2">
      {modelInfo.hasActiveModel && (
        <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/20 rounded">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-700">
              Active Model v{modelInfo.totalVersions > 0 ? modelInfo.totalVersions : 1}
            </span>
          </div>
          {modelInfo.activeModelRoot && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const chainLink = `https://chainscan-galileo.0g.ai/search?query=${modelInfo.activeModelRoot}`
                window.open(chainLink, '_blank')
              }}
              className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {modelInfo.hasCandidate && (
        <div className="flex items-center justify-between p-2 bg-orange-500/10 border border-orange-500/20 rounded">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-orange-700">
              Candidate Model
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {onActivateModel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMakeActive}
                className="h-6 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-500/20"
              >
                Make Active
              </Button>
            )}
            {modelInfo.candidateModelRoot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const chainLink = `https://chainscan-galileo.0g.ai/search?query=${modelInfo.candidateModelRoot}`
                  window.open(chainLink, '_blank')
                }}
                className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {modelInfo.isTraining && (
        <div className="flex items-center space-x-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded">
          <Clock className="h-4 w-4 text-purple-500 animate-pulse" />
          <span className="text-sm font-medium text-purple-700">
            Training in Progress
          </span>
        </div>
      )}

      {!modelInfo.hasActiveModel && !modelInfo.hasCandidate && !modelInfo.isTraining && (
        <div className="flex items-center space-x-2 p-2 bg-gray-100 border border-gray-200 rounded">
          <Sparkles className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">
            Ready for fine-tuning
          </span>
        </div>
      )}
    </div>
  )
}