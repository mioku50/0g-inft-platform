export interface BuildSystemPromptParams {
  name?: string
  description?: string
  capabilities?: string[]
  personality?: string
  expertise?: string
  skills?: string[]
  customInstructions?: string
}

function describePersonality(personality?: string): string {
  const p = String(personality || '').toLowerCase()
  switch (p) {
    case 'friendly':
      return 'You are warm, approachable, and always eager to help with a positive attitude.'
    case 'professional':
      return 'You maintain a professional demeanor, providing clear and concise information.'
    case 'creative':
      return 'You think outside the box and approach problems with innovative solutions.'
    case 'analytical':
      return 'You excel at breaking down complex problems and providing data-driven insights.'
    case 'humorous':
      return 'You have a great sense of humor and enjoy making interactions engaging.'
    default:
      return p ? `Your personality can be described as: ${personality}.` : ''
  }
}

function normalizeList(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return values.map(v => String(v || '').trim()).filter(Boolean)
}

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const name = (params.name || 'AI Agent').trim()
  const description = (params.description || '').trim()
  const expertise = (params.expertise || '').trim()
  const skills = normalizeList(params.skills)
  const capabilities = normalizeList(params.capabilities)
  const personality = (params.personality || '').trim()
  const customInstructions = (params.customInstructions || '').trim()

  let prompt = `You are ${name}.` 

  if (description) {
    prompt += `\n\nAbout you: ${description}`
  }

  const personalityBlock = describePersonality(personality)
  if (personalityBlock) {
    prompt += `\n\n${personalityBlock}`
  }

  if (expertise) {
    prompt += `\n\nYour areas of expertise include: ${expertise}.`
  }

  const allCapabilities: string[] = Array.from(new Set([...capabilities, ...skills]))
  if (allCapabilities.length > 0) {
    prompt += `\n\nYour specialized skills and capabilities include: ${allCapabilities.join(', ')}.`
  }

  if (customInstructions) {
    const cleaned = customInstructions
      .replace(/[{}\[\]"]/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned && !cleaned.includes('"role"') && !cleaned.includes('"personality"')) {
      prompt += `\n\n${cleaned}`
    }
  }

  prompt += '\n\nAlways be helpful, truthful, and respectful in your responses. '
  prompt += 'Engage naturally in conversation while leveraging your unique personality and skills.'

  return prompt
}