export type FineTuneStatus = 'Init' | 'Training' | 'Finished' | 'Failed'
export interface FineTuneState {
  progress: FineTuneStatus
  elapsedTimeFormatted?: string
  deliverIndex?: number
  modelRootHash?: string
}

export function useFineTuneMonitor(taskId: string) {
  return {
    status: { progress: 'Init' as FineTuneStatus } as FineTuneState,
    isMonitoring: false,
    error: null as any,
    startMonitoring: () => {},
    stopMonitoring: () => {},
    elapsedTime: 0
  }
}

export const FineTuneStatus = {
  getStatusIcon(_: string) {
    return 'Clock'
  },
  getProgressPercentage(_: string) {
    return 0
  },
  getStatusColor(_: string) {
    return 'gray'
  },
  isCompleted(status: string) {
    return status === 'Finished'
  },
  isFailed(status: string) {
    return status === 'Failed'
  },
  isInProgress(status: string) {
    return status === 'Training'
  }
}

export function formatTrainingTime(ms: number) {
  const sec = Math.floor(ms / 1000)
  return `${sec}s`
}
