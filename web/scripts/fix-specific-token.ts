// scripts/fix-specific-token.ts
const fs = require('fs').promises
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: '.env' })

async function fixSpecificToken() {
  console.log('🔧 Creating metadata for specific token\n')
  
  const metadataDir = path.join(process.cwd(), 'data', 'metadata')
  await fs.mkdir(metadataDir, { recursive: true })
  
  // Хэш из логов для токена #13 (OGPandaaa) 
  const problemHash = '0x31f202cb59fc5230ac0542b626309e3a38b0fbd3a2bdef6f6e51495f6d6c1801'
  
  const metadata = {
    name: 'OGPandaaa',
    description: 'Creative AI agent',
    model: 'llama-3.3-70b',
    personality: 'creative',
    systemPrompt: 'You are OGPandaaa, a creative AI assistant.',
    expertise: 'Creative tasks, innovation',
    skills: ['chat', 'writing', 'design'],
    image: `https://api.dicebear.com/7.x/bottts/svg?seed=ogpandaaa`,
    createdAt: new Date().toISOString(),
    creator: '0x0000000000000000000000000000000000000000',
    version: '1.0',
    tokenId: '13'
  }
  
  const filePath = path.join(metadataDir, `${problemHash}.json`)
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2))
  
  console.log(`✅ Created metadata for problem hash`)
  console.log(`   Hash: ${problemHash}`)
  console.log(`   File: ${path.basename(filePath)}`)
}

fixSpecificToken().catch(console.error)