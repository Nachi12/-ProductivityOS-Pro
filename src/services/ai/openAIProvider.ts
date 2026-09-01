import { AIProvider, AICompletionOptions } from './aiProvider.js';

/**
 * OpenAIProvider
 * Uses OpenAI Chat Completions API server-side
 * Zero client-side API key exposure.
 */
export class OpenAIProvider implements AIProvider {
  name = 'OpenAI Chat Completions';
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gpt-4o-mini';
  }

  async completion(prompt: string, systemContext: string = '', options?: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables');
    }

    const messages = [];
    if (systemContext) {
      messages.push({ role: 'system', content: systemContext });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const messageContent = data?.choices?.[0]?.message?.content;
    if (!messageContent) {
      throw new Error('OpenAI API returned empty message content');
    }

    return messageContent.trim();
  }

  async structuredOutput<T>(prompt: string, schema: string, systemContext: string = ''): Promise<T> {
    const textPrompt = `${prompt}\n\nPlease respond strictly in valid JSON format matching this schema:\n${schema}`;
    const rawText = await this.completion(textPrompt, systemContext);

    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
    const cleanJson = jsonMatch[1].trim();

    try {
      return JSON.parse(cleanJson) as T;
    } catch (e: any) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${e.message}`);
    }
  }
}
