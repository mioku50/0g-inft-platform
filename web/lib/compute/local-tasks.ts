import fs from 'fs/promises'
import path from 'path'

const FILE = path.join(process.cwd(), 'data', 'tasks.json')

async function read(): Promise<Record<string, string>> {
  try {
    const c = await fs.readFile(FILE, 'utf-8')
    return JSON.parse(c)
  } catch {
    return {}
  }
}

export async function saveTask(agentId: string, taskId: string) {
  const data = await read()
  data[agentId] = taskId
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(data, null, 2))
}

export async function getTaskId(agentId: string): Promise<string | null> {
  const data = await read()
  return data[agentId] || null
}
