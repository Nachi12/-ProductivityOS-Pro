import { FinanceService } from './financeService.js';
import { getAIProvider } from './ai/aiProvider.js';
import { AIContextService } from './ai/aiContextService.js';
import { AIInsightService, PriorityInsight } from './ai/aiInsightService.js';
import { AICommandParser, NLCommandIntent } from './ai/aiCommandParser.js';

export interface AICopilotResponse {
  query: string;
  answer: string;
  dataUsed: Record<string, any>;
  analysis: string;
  recommendation: string;
  nextAction: string;
  parsedIntent?: NLCommandIntent;
  providerName: string;
}

export interface AIActionItem {
  id: string;
  stepNumber: number;
  title: string;
  category: string;
  impact: string;
  completed: boolean;
  priority: 'P0' | 'P1' | 'P2';
}

export class AICopilotService {
  /**
   * Serialize structured user financial context for AI consumption
   */
  static async generateFinancialContext(userId: string) {
    return AIContextService.generateSummarizedContext(userId);
  }

  /**
   * Process Natural Language Copilot Queries with AIProvider Abstraction & Intent Parsing
   */
  static async processCopilotQuery(userId: string, query: string): Promise<AICopilotResponse> {
    const provider = getAIProvider();
    const context = await AIContextService.generateSummarizedContext(userId);
    const parsedIntent = AICommandParser.parseNaturalLanguageCommand(query);

    const prompt = `User Query: "${query}". Parsed Intent: ${parsedIntent.intentType}. User Summary: Income=${context.summary.totalIncome}, Expenses=${context.summary.totalExpenses}, SavingsRate=${context.summary.savingsRate}, HealthScore=${context.healthScore.overallScore}/100.`;
    const providerCompletion = await provider.completion(prompt, JSON.stringify(context));

    let answer = providerCompletion;
    let analysis = `Financial Analysis: You earned ${context.summary.totalIncome} and spent ${context.summary.totalExpenses} (Savings Rate: ${context.summary.savingsRate}).`;
    let recommendation = context.healthScore.weaknesses[0] || "Maintain your current positive savings trajectory.";
    let nextAction = `Review your priority items in the Monthly Action Plan below.`;

    if (parsedIntent.intentType === 'TRANSACTION_QUERY') {
      recommendation = `Showing transaction records matching min amount ₹${parsedIntent.filters?.minAmount || 0}.`;
      nextAction = `Audit high-value transactions in your Money Ledger.`;
    } else if (parsedIntent.intentType === 'SCENARIO_SIMULATION') {
      recommendation = `Simulation intent detected: Income adjustment of ₹${parsedIntent.scenarioParams?.incomeChangeRupees || 0}.`;
      nextAction = `Open Forecast tab for 5-year compounding simulation.`;
    }

    return {
      query,
      answer,
      dataUsed: {
        totalIncome: context.summary.totalIncome,
        totalExpenses: context.summary.totalExpenses,
        savingsRate: context.summary.savingsRate,
        healthScore: context.healthScore.overallScore
      },
      analysis,
      recommendation,
      nextAction,
      parsedIntent,
      providerName: provider.name
    };
  }

  /**
   * Execute Natural Language Command Parsing
   */
  static async parseCommand(query: string): Promise<NLCommandIntent> {
    return AICommandParser.parseNaturalLanguageCommand(query);
  }

  /**
   * Generate Proactive Priority Insights
   */
  static async generateInsights(userId: string): Promise<PriorityInsight[]> {
    return AIInsightService.generatePriorityInsights(userId);
  }

  /**
   * Explain specific financial metric with AI
   */
  static async explainMetric(userId: string, metric: string): Promise<{ metric: string; explanation: string; score: number }> {
    const context = await AIContextService.generateSummarizedContext(userId);
    
    let explanation = `Your ${metric.replace('_', ' ')} is calculated deterministically from your ledger records.`;
    if (metric === 'health_score') {
      explanation = context.healthScore.explanation;
    } else if (metric === 'savings_rate') {
      explanation = `Your savings rate is ${context.summary.savingsRate}. Aim for 20%+ to build liquid compounding capital.`;
    }

    return {
      metric,
      explanation,
      score: context.healthScore.overallScore
    };
  }

  /**
   * Build Monthly Financial Action Plan
   */
  static async generateActionPlan(userId: string): Promise<AIActionItem[]> {
    return [
      {
        id: 'act_1',
        stepNumber: 1,
        title: 'Transfer 20% of income to Emergency Reserve on payday',
        category: 'Savings',
        impact: 'Builds 3-month liquid buffer',
        completed: false,
        priority: 'P0'
      },
      {
        id: 'act_2',
        stepNumber: 2,
        title: 'Review food & dining discretionary expenses',
        category: 'Expense Control',
        impact: 'Saves up to ₹3,000 monthly',
        completed: false,
        priority: 'P1'
      },
      {
        id: 'act_3',
        stepNumber: 3,
        title: 'Simulate ₹2,000 extra payment in Debt-Free Simulator',
        category: 'Debt Payoff',
        impact: 'Reduces total interest payable',
        completed: false,
        priority: 'P1'
      },
      {
        id: 'act_4',
        stepNumber: 4,
        title: 'Audit recurring subscriptions and memberships',
        category: 'Recurring Costs',
        impact: 'Eliminates unused recurring charges',
        completed: false,
        priority: 'P2'
      }
    ];
  }
}
