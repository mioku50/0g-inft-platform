// web/lib/agents/personalization.ts
export interface AgentPersonalization {
  userId: string
  agentTokenId: number
  preferences: {
    communicationStyle: 'formal' | 'casual' | 'friendly' | 'professional'
    responseLength: 'concise' | 'detailed' | 'balanced'
    creativityLevel: number // 0-10
    specializedKnowledge: string[]
  }
  conversationHistory: {
    summary: string
    keyTopics: string[]
    userPreferences: Record<string, any>
  }
}

export async function personalizeAgent(
  agent: any,
  personalization: AgentPersonalization
): Promise<string> {
  const basePrompt = agent.metadata.systemPrompt || ''
  
  const personalizedAddendum = `
  
# User Personalization
- Communication style: ${personalization.preferences.communicationStyle}
- Preferred response length: ${personalization.preferences.responseLength}
- Creativity level: ${personalization.preferences.creativityLevel}/10
- Areas of interest: ${personalization.preferences.specializedKnowledge.join(', ')}

# Conversation Context
${personalization.conversationHistory.summary}

Remember to adapt your responses based on these preferences while maintaining your core capabilities.`

  return basePrompt + personalizedAddendum
}