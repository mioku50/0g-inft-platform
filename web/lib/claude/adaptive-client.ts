// lib/claude/adaptive-client.ts
import { Anthropic } from "@anthropic-ai/sdk";
import { CLAUDE_MODELS } from "./models";

export class AdaptiveClaudeClient {
  private client: Anthropic;
  private modelPriority = [
    CLAUDE_MODELS.SONNET_4,
    CLAUDE_MODELS.SONNET_3_5,
    CLAUDE_MODELS.HAIKU_3_5,
    CLAUDE_MODELS.HAIKU_3,
  ];
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, timeout: 60_000 });
  }
  
  async createMessage(params: any, preferredModel?: string) {
    const models = preferredModel 
      ? [preferredModel, ...this.modelPriority.filter(m => m !== preferredModel)]
      : this.modelPriority;
    
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        const response = await this.retryWithBackoff(
          () => this.client.messages.create({ ...params, model })
        );
        
        console.log(`Success with model: ${model}`);
        return { ...response, usedModel: model };
      } catch (error: any) {
        if (error.status === 529) {
          console.log(`Model ${model} is overloaded, trying next...`);
          continue;
        }
        throw error;
      }
    }
    
    throw new Error("All models are overloaded");
  }
  
  private async retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.status === 529 && i < maxRetries - 1) {
          const delay = Math.min(30000, 5000 * Math.pow(2, i));
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
  }
}