import { AIProvider, AICompletionOptions } from './aiProvider.js';

/**
 * GeminiProvider
 * Uses Google Gemini 1.5 Flash REST API server-side
 * Zero client-side API key exposure.
 */
export class GeminiProvider implements AIProvider {
  name = 'Google Gemini 1.5 Flash';
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gemini-1.5-flash';
  }

  async completion(prompt: string, systemContext: string = '', options?: AICompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const contents = [];
    if (systemContext) {
      contents.push({ role: 'user', parts: [{ text: `[SYSTEM CONTEXT & INSTRUCTIONS]\n${systemContext}` }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood. I will strictly follow system instructions and operate as a financial intelligence system.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens ?? 1000
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini API returned empty response candidates');
    }

    return candidateText.trim();
  }

  async structuredOutput<T>(prompt: string, schema: string, systemContext: string = ''): Promise<T> {
    const textPrompt = `${prompt}\n\nPlease respond strictly in valid JSON format matching this schema:\n${schema}`;
    const rawText = await this.completion(textPrompt, systemContext);
    
    // Extract JSON block if wrapped in markdown code blocks
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
    const cleanJson = jsonMatch[1].trim();

    try {
      return JSON.parse(cleanJson) as T;
    } catch (e: any) {
      throw new Error(`Failed to parse Gemini response as JSON: ${e.message}`);
    }
  }
}
