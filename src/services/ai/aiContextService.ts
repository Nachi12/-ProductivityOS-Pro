import { FinanceService } from '../financeService.js';
import { Transaction } from '../../models/Transaction.js';
import { Loan } from '../../models/Loan.js';

export interface SummarizedFinancialContext {
  userId: string;
  summary: {
    totalIncome: string;
    totalExpenses: string;
    netCashFlow: string;
    savingsRate: string;
    totalDebt: string;
    totalEMI: string;
    debtToIncomeRatio: string;
  };
  healthScore: {
    overallScore: number;
    rating: string;
    explanation: string;
    strengths: string[];
    weaknesses: string[];
    warnings: string[];
  };
  topCategories: { category: string; formattedAmount: string; percentage: number }[];
  activeLoans: { name: string; remainingBalance: string; monthlyEMI: string; interestRate: number }[];
  recentChanges: string[];
}

export class AIContextService {
  /**
   * Serialize summarized, normalized user financial context for AI consumption
   */
  static async generateSummarizedContext(userId: string): Promise<SummarizedFinancialContext> {
    const summary = await FinanceService.calculateSummary(userId);
    const healthScore = await FinanceService.calculateFinancialHealthScore(userId);
    const categoryBreakdown = await FinanceService.calculateCategoryBreakdown(userId, 'EXPENSE');
    const loans = await Loan.find({ userId, status: 'ACTIVE' });

    const topCategories = categoryBreakdown.slice(0, 5).map(c => ({
      category: c.category,
      formattedAmount: c.formattedAmount,
      percentage: c.percentage
    }));

    const activeLoans = loans.map(l => ({
      name: l.name,
      remainingBalance: summary.formatted.totalLoanOutstanding,
      monthlyEMI: summary.formatted.totalMonthlyEMI,
      interestRate: l.interestRateAnnual
    }));

    const recentChanges: string[] = [];
    if (summary.savingsRatePercentage >= 20) {
      recentChanges.push(`Savings rate is healthy at ${summary.savingsRatePercentage.toFixed(1)}%`);
    } else {
      recentChanges.push(`Savings rate is below target at ${summary.savingsRatePercentage.toFixed(1)}%`);
    }

    if (summary.netCashFlowInPaise > 0) {
      recentChanges.push(`Net cash flow is positive (${summary.formatted.netCashFlow})`);
    } else if (summary.netCashFlowInPaise < 0) {
      recentChanges.push(`Negative cash flow detected (${summary.formatted.netCashFlow})`);
    }

    return {
      userId,
      summary: {
        totalIncome: summary.formatted.totalIncome,
        totalExpenses: summary.formatted.totalExpenses,
        netCashFlow: summary.formatted.netCashFlow,
        savingsRate: summary.formatted.savingsRate,
        totalDebt: summary.formatted.totalLoanOutstanding,
        totalEMI: summary.formatted.totalMonthlyEMI,
        debtToIncomeRatio: summary.formatted.debtToIncomeRatio
      },
      healthScore: {
        overallScore: healthScore.overallScore,
        rating: healthScore.rating,
        explanation: healthScore.explanation,
        strengths: healthScore.strengths,
        weaknesses: healthScore.weaknesses,
        warnings: healthScore.warnings
      },
      topCategories,
      activeLoans,
      recentChanges
    };
  }
}
