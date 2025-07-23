import { MetadataSyncService } from '../lib/services/metadata-sync'

const service = MetadataSyncService.getInstance()

async function runMetadataSync() {
  try {
    await service.syncOnce()
  } catch (e) {
    console.error('[MetadataSync]', e)
  }
}

const FIVE_MIN = 5 * 60 * 1000
let lastRun = 0
async function runThrottled() {
  const now = Date.now()
  if (now - lastRun < FIVE_MIN) return
  lastRun = now
  await runMetadataSync()
}

const ONE_HOUR = 60 * 60 * 1000
if (process.env.NODE_ENV === 'production') {
  setInterval(runThrottled, ONE_HOUR)
} else {
  runThrottled()
}
