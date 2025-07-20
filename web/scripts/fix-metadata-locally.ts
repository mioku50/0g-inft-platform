// scripts/fix-metadata-locally.ts
export {}
const fs = require('fs').promises
const path = require('path')
const cryptoModule = require('crypto')
const dotenv = require('dotenv')

dotenv.config({ path: '.env' })

// Метаданные для проблемных токенов #1-5
const DEFAULT_METADATA: Record<string, any> = {
  '1': {
    name: 'Genesis Agent',
    description: 'The first AI agent on the platform',
    model: 'llama-3.3-70b',
    personality: 'friendly',
    systemPrompt: 'You are Genesis Agent, the first AI assistant created on this platform. Be helpful and welcoming.',
    expertise: 'General assistance, Platform guidance',
    skills: ['chat', 'analysis'],
    image: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis-agent'
  },
  '2': {
    name: 'Code Master',
    description: 'Expert programming assistant',
    model: 'deepseek-r1-70b',
    personality: 'professional',
    systemPrompt: 'You are Code Master, an expert in programming and software development.',
    expertise: 'Programming, Software Architecture, Debugging',
    skills: ['coding', 'analysis', 'chat'],
    image: 'https://api.dicebear.com/7.x/bottts/svg?seed=code-master'
  },
  '3': {
    name: 'Creative Spirit',
    description: 'Artistic and creative AI companion',
    model: 'llama-3.3-70b',
    personality: 'creative',
    systemPrompt: 'You are Creative Spirit, helping users with creative projects and artistic endeavors.',
    expertise: 'Creative Writing, Art, Design Thinking',
    skills: ['writing', 'design', 'chat'],
    image: 'https://api.dicebear.com/7.x/bottts/svg?seed=creative-spirit'
  },
  '4': {
    name: 'Data Sage',
    description: 'Data analysis and insights expert',
    model: 'deepseek-r1-70b',
    personality: 'analytical',
    systemPrompt: 'You are Data Sage, specializing in data analysis and providing insights.',
    expertise: 'Data Analysis, Statistics, Business Intelligence',
    skills: ['analysis', 'chat'],
    image: 'https://api.dicebear.com/7.x/bottts/svg?seed=data-sage'
  },
  '5': {
    name: 'Learning Buddy',
    description: 'Educational assistant and tutor',
    model: 'llama-3.3-70b',
    personality: 'friendly',
    systemPrompt: 'You are Learning Buddy, a patient and encouraging educational assistant.',
    expertise: 'Education, Tutoring, Study Assistance',
    skills: ['chat', 'writing', 'analysis'],
    image: 'https://api.dicebear.com/7.x/bottts/svg?seed=learning-buddy'
  }
}

async function fixMetadataLocally() {
  console.log('🔧 Fixing Metadata for Problematic Tokens\n')
  
  const metadataDir = path.join(process.cwd(), 'data', 'metadata')
  await fs.mkdir(metadataDir, { recursive: true })
  
  console.log('📁 Metadata directory:', metadataDir)
  console.log('\n🔨 Creating metadata files for tokens #1-5...\n')
  
  const createdHashes: Record<string, string> = {}
  
  // Создаем локальные файлы для проблемных токенов
  for (const [tokenId, metadata] of Object.entries(DEFAULT_METADATA)) {
    const fullMetadata = {
      ...metadata,
      createdAt: new Date().toISOString(),
      creator: '0x0000000000000000000000000000000000000000',
      version: '1.0',
      isClone: false,
      fixed: true,
      tokenId: tokenId
    }
    
    const content = JSON.stringify(fullMetadata, null, 2)
    const hash = '0x' + cryptoModule.createHash('sha256').update(content).digest('hex')
    
    const filePath = path.join(metadataDir, `${hash}.json`)
    await fs.writeFile(filePath, content)
    
    createdHashes[tokenId] = hash
    
    console.log(`✅ Token #${tokenId}: ${metadata.name}`)
    console.log(`   Hash: ${hash}`)
    console.log(`   File: ${path.basename(filePath)}\n`)
  }
  
  console.log('✨ Local metadata files created successfully!')
  console.log('\n📝 These hashes will be used as fallback when retrieval fails.')
  console.log('\n💡 To use these metadata files:')
  console.log('   1. The retrieve API will automatically find them')
  console.log('   2. Or you can manually update token URIs in the contract')
  
  // Создаем mapping файл для удобства
  const mappingPath = path.join(metadataDir, 'token-hash-mapping.json')
  await fs.writeFile(mappingPath, JSON.stringify(createdHashes, null, 2))
  console.log('\n📋 Token-hash mapping saved to:', mappingPath)
}

fixMetadataLocally().catch(console.error)