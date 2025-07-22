process.env.MOCK_FINE_TUNE = '1'
process.env.OG_STORAGE_PRIVATE_KEY = '0x' + '1'.repeat(64)

import 'tsconfig-paths/register'
import { POST as uploadDataset } from '../app/api/storage/upload-dataset/route'
import { POST as startFineTune, GET as getFineTune } from '../app/api/compute/fine-tune/route'
import { NextRequest } from 'next/server'

async function main() {
  const file = new File([Buffer.from('{"a":1}\n')], 'd.jsonl')
  const form = new FormData()
  form.append('file', file)
  let res = await uploadDataset(new NextRequest('http://localhost', { method: 'POST', body: form }))
  let data: any = await res.json()
  const root = data.root

  // @ts-ignore
  res = await startFineTune(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({
    agentId: '1',
    datasetRoot: root,
    baseModel: 'llama',
    steps: 1,
    learningRate: 0.1
  }) }))
  data = await res.json() as any
  const taskId = data.taskId

  for (let i = 0; i < 5; i++) {
    // @ts-ignore
    res = await getFineTune(new NextRequest(`http://localhost?taskId=${taskId}`))
    data = await res.json() as any
    if (data.progress === 'Finished') {
      console.log('🎉 fine-tune flow OK')
      return
    }
  }
  throw new Error('flow did not finish')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
