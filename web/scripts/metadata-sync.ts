import { MetadataSyncService } from '../lib/services/metadata-sync'

const service = MetadataSyncService.getInstance()

async function runMetadataSync() {
  try {
    await service.syncOnce()
  } catch (e) {
    console.error('[MetadataSync]', e)
  }
}

const ONE_HOUR = 60 * 60 * 1000
if (process.env.NODE_ENV === 'production') {
  setInterval(runMetadataSync, ONE_HOUR)
} else {
  runMetadataSync()
}
