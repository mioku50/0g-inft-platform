// web/scripts/metadata-sync.ts
export {}
import { MetadataSyncService } from '../lib/services/metadata-sync'

const service = MetadataSyncService.getInstance()

async function run() {
  try {
    await service.syncOnce()
  } catch (e) {
    console.error('[MetadataSync]', e)
  }
}

run()
setInterval(run, 60 * 60 * 1000)
