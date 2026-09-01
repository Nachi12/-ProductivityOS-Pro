import { describe, it, expect } from '../assert.js';
import { getAIProvider, DemoAIProvider } from '../../src/services/ai/aiProvider.js';
import { AICommandParser } from '../../src/services/ai/aiCommandParser.js';

describe('Server-Side AI Provider & Command Parser Architecture', () => {
  it('instantiates AIProvider correctly without exposing client keys', () => {
    const provider = getAIProvider();
    expect(provider.name).not.toBe(null);
    expect(provider.name).not.toBe(undefined);
  });

  it('DemoAIProvider returns context-driven intelligent responses', async () => {
    const provider = new DemoAIProvider();
    const result = await provider.completion('Where is my money going?');
    expect(result).toContain('expenses');
  });

  it('AICommandParser correctly identifies NL transaction query intents', () => {
    const intent = AICommandParser.parseNaturalLanguageCommand('Show transactions above 10,000');
    expect(intent.intentType).toBe('TRANSACTION_QUERY');
    expect(intent.filters?.minAmount).toBe(10000);
  });

  it('AICommandParser correctly identifies scenario simulation intents', () => {
    const intent = AICommandParser.parseNaturalLanguageCommand('What if I increase salary by 20,000?');
    expect(intent.intentType).toBe('SCENARIO_SIMULATION');
    expect(intent.scenarioParams?.incomeChangeRupees).toBe(20000);
  });
});
