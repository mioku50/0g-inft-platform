// components/fine-tune/FineTuneStatus.tsx
'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { 
  Clock, 
  Settings, 
  Brain, 
  Upload, 
  CheckCircle, 
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  RefreshCw,
  Activity
} from 'lucide-react'

interface FineTuneStatusProps {
  taskId: string
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
  autoStart?: boolean
}

// Утилиты для статуса
const getStatusIcon = (statusName: string) => {
  switch (statusName) {
    case 'Init': return Clock
    case 'SettingUp': return Settings
    case 'Training': return Brain
    case 'Delivering': return Upload
    case 'Finished': return CheckCircle
    case 'Failed': return XCircle
    default: return Activity
  }
}

const getProgressPercentage = (status: string): number => {
  switch (status) {
    case 'Init': return 10
    case 'SettingUp': return 25
    case 'Training': return 60
    case 'Trained': return 80
    case 'Delivering': return 90
    case 'Delivered': return 95
    case 'Finished': return 100
    case 'Failed': return 0
    default: return 0
  }
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Init': return 'text-yellow-400'
    case 'SettingUp': return 'text-orange-400'
    case 'Training': return 'text-purple-400'
    case 'Trained': return 'text-blue-400'
    case 'Delivering': return 'text-blue-400'
    case 'Delivered': return 'text-green-400'
    case 'Finished': return 'text-green-500'
    case 'Failed': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

const isCompleted = (status: string): boolean => status === 'Finished'
const isFailed = (status: string): boolean => status === 'Failed'
const isInProgress = (status: string): boolean => 
  ['Init', 'SettingUp', 'Training', 'Delivering'].includes(status)

const formatTrainingTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`
  } else if (mins > 0) {
    return `${mins}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

// Hook для мониторинга Fine-tuning
function useFineTuneMonitor(taskId: string) {
  const [status, setStatus] = React.useState<any>(null)
  const [isMonitoring, setIsMonitoring] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const [elapsedTime, setElapsedTime] = React.useState(0)
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = React.useRef<number>(Date.now())

  const startMonitoring = React.useCallback(() => {
    if (!taskId || isMonitoring) return

    setIsMonitoring(true)
    setError(null)
    startTimeRef.current = Date.now()

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/compute/fine-tune?taskId=${taskId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.status}`)
        }
        
        const data = await response.json()
        setStatus(data)
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))

        // Остановить мониторинг если задача завершена
        if (isCompleted(data.progress) || isFailed(data.progress)) {
          stopMonitoring()
        }
      } catch (err) {
        setError(err as Error)
        stopMonitoring()
      }
    }

    // Немедленно получить статус
    pollStatus()

    // Установить интервал
    intervalRef.current = setInterval(pollStatus, 10000) // каждые 10 секунд
  }, [taskId, isMonitoring])

  const stopMonitoring = React.useCallback(() => {
    setIsMonitoring(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    status,
    isMonitoring,
    error,
    elapsedTime,
    startMonitoring,
    stopMonitoring
  }
}

export function FineTuneStatusComponent({ 
  taskId, 
  onComplete, 
  onError,
  autoStart = true 
}: FineTuneStatusProps) {
  const { 
    status, 
    isMonitoring, 
    error, 
    startMonitoring, 
    stopMonitoring,
    elapsedTime 
  } = useFineTuneMonitor(taskId)

  React.useEffect(() => {
    if (autoStart && taskId && !isMonitoring) {
      startMonitoring()
    }
  }, [taskId, autoStart, isMonitoring, startMonitoring])

  React.useEffect(() => {
    if (status?.progress === 'Finished') {
      onComplete?.(status)
    }
  }, [status, onComplete])

  React.useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  const copyTaskId = async () => {
    try {
      await navigator.clipboard.writeText(taskId)
      toast({
        title: 'Copied!',
        description: 'Task ID copied to clipboard'
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy task ID',
        variant: 'destructive'
      })
    }
  }

  const refreshStatus = async () => {
    if (isMonitoring) {
      stopMonitoring()
      setTimeout(startMonitoring, 1000)
    } else {
      startMonitoring()
    }
  }

  if (!status && !error && !isMonitoring) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">Initializing task monitor...</p>
          <Button 
            onClick={startMonitoring}
            variant="outline" 
            className="mt-4"
          >
            Start Monitoring
          </Button>
        </div>
      </Card>
    )
  }

  if (error && !status) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
        <Alert className="bg-red-500/10 border-red-500/30">
          <XCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-200">
            <div className="space-y-2">
              <div className="font-medium">Monitoring Error</div>
              <div className="text-sm">{error.message}</div>
              <Button 
                onClick={refreshStatus}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">Loading task status...</p>
        </div>
      </Card>
    )
  }

  const StatusIcon = getStatusIcon(status.progress)
  const progressPercentage = getProgressPercentage(status.progress)
  const statusColor = getStatusColor(status.progress)
  const completed = isCompleted(status.progress)
  const failed = isFailed(status.progress)
  const inProgress = isInProgress(status.progress)

  return (
    <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full bg-white/10 flex items-center justify-center ${
            inProgress ? 'animate-pulse' : ''
          }`}>
            {inProgress ? (
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            ) : (
              <StatusIcon className={`w-6 h-6 ${statusColor}`} />
            )}
          </div>
          <div>
            <h3 className={`text-xl font-semibold ${statusColor}`}>
              {status.progress}
            </h3>
            <p className="text-gray-300 text-sm">
              Task: {taskId.slice(0, 8)}...
              <Button
                onClick={copyTaskId}
                size="sm"
                variant="ghost"
                className="h-auto p-1 ml-2"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={completed ? 'default' : failed ? 'destructive' : 'secondary'}>
            {progressPercentage}% Complete
          </Badge>
          <Button
            onClick={refreshStatus}
            size="sm"
            variant="ghost"
            disabled={isMonitoring}
          >
            <RefreshCw className={`h-4 w-4 ${isMonitoring ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-300">Progress</span>
          <span className="text-sm text-gray-300">
            {formatTrainingTime(elapsedTime)}
          </span>
        </div>
        <Progress 
          value={progressPercentage} 
          className="h-2 bg-white/10"
        />
      </div>

      {/* Status Details */}
      <div className="space-y-4">
        {/* Task Information */}
        <div className="bg-black/20 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Status:</span>
              <span className={`ml-2 font-medium ${statusColor}`}>
                {status.progress}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Elapsed:</span>
              <span className="ml-2 font-medium text-white">
                {formatTrainingTime(elapsedTime)}
              </span>
            </div>
            {status.deliverIndex !== undefined && (
              <div>
                <span className="text-gray-400">Delivery Index:</span>
                <span className="ml-2 font-medium text-white">
                  {status.deliverIndex}
                </span>
              </div>
            )}
            {status.modelRootHash && (
              <div className="col-span-2">
                <span className="text-gray-400">Model Hash:</span>
                <code className="ml-2 text-xs bg-white/10 px-2 py-1 rounded text-green-400">
                  {status.modelRootHash.slice(0, 16)}...
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {status.progress === 'Training' && (
          <Alert className="bg-purple-500/10 border-purple-500/30">
            <Brain className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-purple-200">
              Model training in progress. This usually takes 30-60 minutes.
            </AlertDescription>
          </Alert>
        )}

        {status.progress === 'Delivering' && (
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Upload className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              Uploading trained model to 0G Storage. Almost done!
            </AlertDescription>
          </Alert>
        )}

        {completed && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200">
              <div className="space-y-2">
                <div className="font-medium">Training completed successfully!</div>
                <div className="text-sm">
                  Your agent has been enhanced with the training data.
                </div>
                {status.modelRootHash && (
                  <div className="text-xs">
                    Model hash: <code className="bg-white/10 px-1 rounded">{status.modelRootHash}</code>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {failed && (
          <Alert className="bg-red-500/10 border-red-500/30">
            <XCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200">
              <div className="space-y-2">
                <div className="font-medium">Training failed</div>
                <div className="text-sm">
                  The fine-tuning process encountered an error. Please try again.
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between">
        <div className="flex gap-2">
          {!isMonitoring && inProgress && (
            <Button
              onClick={startMonitoring}
              size="sm"
              variant="outline"
            >
              Resume Monitoring
            </Button>
          )}
          {isMonitoring && (
            <Button
              onClick={stopMonitoring}
              size="sm"
              variant="outline"
            >
              Pause Monitoring
            </Button>
          )}
        </div>

        {status.modelRootHash && (
          <Button
            onClick={() => window.open(`https://explorer.0g.ai/hash/${status.modelRootHash}`, '_blank')}
            size="sm"
            variant="outline"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Model
          </Button>
        )}
      </div>
    </Card>
  )
}