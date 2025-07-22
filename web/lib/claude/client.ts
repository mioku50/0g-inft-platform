// lib/claude/client.ts
import { Anthropic } from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 60_000,
});

export async function createMessage(params: any) {
  const maxRetries = 5; // Увеличим количество попыток
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await claude.messages.create(params);
    } catch (error: any) {
      lastError = error;
      
      if (error.status === 529 && error.headers?.get('x-should-retry') === 'true') {
        // Увеличиваем начальную задержку и добавляем случайность
        const baseDelay = 5000; // 5 секунд вместо 1
        const jitter = Math.random() * 1000; // Случайная задержка 0-1 сек
        const waitTime = (baseDelay * Math.pow(2, i)) + jitter;
        
        console.log(`Server overloaded (attempt ${i + 1}/${maxRetries}), retrying in ${Math.round(waitTime/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}