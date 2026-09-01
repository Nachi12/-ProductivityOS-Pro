import { AIContextService } from './aiContextService.js';
import { FinanceService } from '../financeService.js';

export interface PriorityInsight {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SPENDING' | 'INCOME' | 'DEBT' | 'SAVINGS' | 'CASH_FLOW' | 'RISK' | 'OPPORTUNITY';
  title: string;
  explanation: string;
  financialImpact: string;
  recommendedAction: string;
  expectedImpact: string;
  confidenceScore: number;
}

export class AIInsightService {
  /**
   * Generate Proactive Priority Insights matrix
   */
  static async generatePriorityInsights(userId: string): Promise<PriorityInsight[]> {
    const context = await AIContextService.generateSummarizedContext(userId);
    const summary = await FinanceService.calculateSummary(userId);
    const insights: PriorityInsight[] = [];

    // 1. Negative Cash Flow Critical Alert
    if (summary.netCashFlowInPaise < 0) {
      insights.push({
        id: `ins_crit_cashflow_${Date.now()}`,
        severity: 'CRITICAL',
        category: 'CASH_FLOW',
        title: 'Negative Cash Flow Alert',
        explanation: `Your monthly expenses (${summary.formatted.totalExpenses}) exceed your monthly income (${summary.formatted.totalIncome}) by ${summary.formatted.netCashFlow}.`,
        financialImpact: `Draining liquid reserves by ${summary.formatted.netCashFlow} every month.`,
        recommendedAction: 'Audit discretionary expenses immediately and pause non-essential purchases.',
        expectedImpact: 'Restores positive net cash flow within 30 days.',
        confidenceScore: 0.99
      });
    }

    // 2. High Debt-to-Income Warning
    if (summary.debtToIncomeRatioPercentage > 40) {
      insights.push({
        id: `ins_high_debt_${Date.now()}`,
        severity: 'HIGH',
        category: 'DEBT',
        title: 'Elevated Debt Service Ratio',
        explanation: `EMIs account for ${summary.debtToIncomeRatioPercentage.toFixed(1)}% of total monthly income.`,
        financialImpact: `Restricts flexible cash flow by ${summary.formatted.totalMonthlyEMI} monthly.`,
        recommendedAction: 'Apply the Avalanche Payoff strategy by making additional ₹2,000 EMI contributions.',
        expectedImpact: 'Shortens loan tenure by up to 14 months.',
        confidenceScore: 0.94
      });
    }

    // 3. Savings Rate Benchmark Opportunity
    if (summary.savingsRatePercentage < 20) {
      insights.push({
        id: `ins_med_savings_${Date.now()}`,
        severity: 'MEDIUM',
        category: 'SAVINGS',
        title: 'Savings Rate Below 20% Benchmark',
        explanation: `Current savings rate is ${summary.savingsRatePercentage.toFixed(1)}%. Financial guidelines target 20%+.`,
        financialImpact: `Missing an estimated ${summary.formatted.totalIncome} annual wealth accumulation potential.`,
        recommendedAction: 'Automate a payday transfer of 15% directly into high-yield savings.',
        expectedImpact: 'Boosts Financial Health Score by +12 points.',
        confidenceScore: 0.91
      });
    } else {
      insights.push({
        id: `ins_low_healthy_${Date.now()}`,
        severity: 'LOW',
        category: 'OPPORTUNITY',
        title: 'Strong Savings Compounding Trajectory',
        explanation: `Your savings rate of ${summary.savingsRatePercentage.toFixed(1)}% exceeds standard target benchmarks.`,
        financialImpact: 'Accelerates net worth growth timeline.',
        recommendedAction: 'Allocate surplus monthly savings towards long-term investment goals.',
        expectedImpact: 'Increases projected 5-year wealth accumulation.',
        confidenceScore: 0.97
      });
    }

    return insights;
  }
}
