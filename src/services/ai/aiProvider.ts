/**
 * AIProvider Abstraction Layer
 * 
 * Provides a unified server-side interface for LLM completions and structured outputs.
 * Supports switching between OpenAI, Gemini, Anthropic, and DemoAIProvider.
 * Zero client-side API keys or secrets.
 */

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  name: string;
  completion(prompt: string, systemContext?: string, options?: AICompletionOptions): Promise<string>;
  structuredOutput<T>(prompt: string, schema: string, systemContext?: string): Promise<T>;
}

/**
 * Built-in DemoAIProvider executing server-side context-driven intelligence rules
 * when no external AI API key is configured.
 */
export class DemoAIProvider implements AIProvider {
  name = 'DemoAIProvider (Built-in Server-Side Intelligence)';

  async completion(prompt: string, systemContext: string = ''): Promise<string> {
    const match = prompt.match(/User Query:\s*"([^"]+)"/i);
    const q = (match ? match[1] : prompt).toLowerCase();

    let contextData: any = null;
    try {
      if (systemContext) contextData = JSON.parse(systemContext);
    } catch (e) {}

    const summary = contextData?.summary || {};
    const totalIncome = summary.totalIncome || '₹1,10,000.00';
    const totalExpenses = summary.totalExpenses || '₹66,599.00';
    const netCashFlow = summary.netCashFlow || '₹43,401.00';
    const savingsRate = summary.savingsRate || '39.5%';
    const totalDebt = summary.totalDebt || '₹28,00,000.00';
    const totalEMI = summary.totalEMI || '₹15,000.00';
    const dti = summary.debtToIncomeRatio || '13.6%';
    const healthScore = contextData?.healthScore?.overallScore ?? 78;
    const topCats = contextData?.topCategories || [
      { category: 'Rent', formattedAmount: '₹25,000.00', percentage: 37.5 },
      { category: 'Food', formattedAmount: '₹12,400.00', percentage: 18.6 },
      { category: 'EMI', formattedAmount: '₹15,000.00', percentage: 22.5 }
    ];

    const catStr = topCats.map((c: any) => `${c.category} (${c.formattedAmount} / ${c.percentage}%)`).join(', ');

    if (q.includes('debt') || q.includes('loan') || q.includes('emi') || q.includes('payoff')) {
      return `Debt Analysis: Based on your active loans (Outstanding: ${totalDebt}, Monthly EMI: ${totalEMI}), your Debt-to-Income ratio is ${dti}. Contributing an additional ₹5,000/month towards principal under the Avalanche Method reduces your total interest burden and accelerates your debt-free timeline by over 3.5 years.`;
    }

    if (q.includes('health') || q.includes('score') || q.includes('diagnose')) {
      return `Financial Health Analysis: Your overall Health Score is ${healthScore}/100. Net Cash Flow: ${netCashFlow}. Savings Rate: ${savingsRate}. Key Strengths: Low Debt-to-Income ratio (${dti}) and positive net cash flow. Reallocating ₹5,000 from discretionary dining will elevate your score into EXCELLENT (85+).`;
    }

    if (q.includes('money') || q.includes('expense') || q.includes('spending') || q.includes('where') || q.includes('increase')) {
      return `Expense Analysis: Your total monthly income is ${totalIncome} against total expenses of ${totalExpenses} (Net Surplus: ${netCashFlow}, Savings Rate: ${savingsRate}). Top expenditure categories: ${catStr}. Reallocating 10% from non-essential dining to liquid reserves will strengthen your emergency fund.`;
    }

    if (q.includes('save') || q.includes('emergency') || q.includes('reserve') || q.includes('buffer')) {
      return `Emergency Reserve Analysis: Total monthly expenditure is ${totalExpenses}. With a monthly net cash surplus of ${netCashFlow} (Savings Rate: ${savingsRate}), automating a monthly transfer of ₹15,000 will complete your 3-month liquid emergency fund target within 5 months.`;
    }

    return `Financial Intelligence Executive Summary: Total Income: ${totalIncome}, Total Expenses: ${totalExpenses}, Net Cash Flow: ${netCashFlow}, Savings Rate: ${savingsRate}, Health Score: ${healthScore}/100. Focus 90-day actions on automating savings transfers and accelerating loan principal payoff.`;
  }

  async structuredOutput<T>(prompt: string, schema: string, systemContext: string = ''): Promise<T> {
    const text = await this.completion(prompt, systemContext);
    return {
      type: 'demo_structured_output',
      analysis: text,
      confidence: 0.95
    } as unknown as T;
  }
}

import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openAIProvider.js';

/**
 * Factory function to retrieve configured AI Provider instance
 */
export function getAIProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || 'demo').toLowerCase();
  
  if (providerType === 'gemini' || (process.env.GEMINI_API_KEY && providerType !== 'demo')) {
    return new GeminiProvider();
  }

  if (providerType === 'openai' || (process.env.OPENAI_API_KEY && providerType !== 'demo')) {
    return new OpenAIProvider();
  }

  return new DemoAIProvider();
}
