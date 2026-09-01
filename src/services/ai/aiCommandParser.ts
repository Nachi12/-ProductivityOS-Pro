export interface NLCommandIntent {
  intentType: 'TRANSACTION_QUERY' | 'SCENARIO_SIMULATION' | 'DEBT_STRATEGY' | 'EXPLAIN_METRIC' | 'UNKNOWN';
  rawQuery: string;
  filters?: {
    minAmount?: number;
    maxAmount?: number;
    category?: string;
    period?: string;
  };
  scenarioParams?: {
    incomeChangeRupees?: number;
    expenseChangeRupees?: number;
    extraEMIRupees?: number;
  };
  metricTarget?: string;
}

export class AICommandParser {
  /**
   * Convert Natural Language financial prompts into structured intent objects
   */
  static parseNaturalLanguageCommand(query: string): NLCommandIntent {
    const q = query.toLowerCase().trim();

    // 1. Transaction Filtering Commands
    if (q.includes('transactions') || q.includes('expenses above') || q.includes('top expenses')) {
      let minAmount = 0;
      if (q.includes('10000') || q.includes('10,000') || q.includes('10k')) minAmount = 10000;
      else if (q.includes('5000') || q.includes('5,000') || q.includes('5k')) minAmount = 5000;
      else if (q.includes('1000') || q.includes('1,000') || q.includes('1k')) minAmount = 1000;

      return {
        intentType: 'TRANSACTION_QUERY',
        rawQuery: query,
        filters: {
          minAmount,
          period: q.includes('last month') ? 'previous_month' : 'current_month'
        }
      };
    }

    // 2. What-If Scenario Commands
    if (q.includes('what if') || q.includes('increase salary') || q.includes('reduce expenses') || q.includes('income increases')) {
      let incomeChange = 0;
      let expenseChange = 0;

      if (q.includes('20000') || q.includes('20,000') || q.includes('20k')) incomeChange = 20000;
      else if (q.includes('10000') || q.includes('10,000') || q.includes('10k')) incomeChange = 10000;

      if (q.includes('reduce') || q.includes('cut')) expenseChange = -5000;

      return {
        intentType: 'SCENARIO_SIMULATION',
        rawQuery: query,
        scenarioParams: {
          incomeChangeRupees: incomeChange,
          expenseChangeRupees: expenseChange
        }
      };
    }

    // 3. Metric Explanation Commands
    if (q.includes('score') || q.includes('health') || q.includes('why')) {
      return {
        intentType: 'EXPLAIN_METRIC',
        rawQuery: query,
        metricTarget: 'health_score'
      };
    }

    // 4. Debt Strategy Commands
    if (q.includes('debt') || q.includes('loan') || q.includes('payoff') || q.includes('avalanche')) {
      return {
        intentType: 'DEBT_STRATEGY',
        rawQuery: query
      };
    }

    return {
      intentType: 'UNKNOWN',
      rawQuery: query
    };
  }
}
