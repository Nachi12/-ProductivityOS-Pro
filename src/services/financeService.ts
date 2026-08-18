import { Transaction, ITransaction } from '../models/Transaction.js';
import { Loan, ILoan } from '../models/Loan.js';
import { paiseToRupees, rupeesToPaise, formatINR } from '../utils/money.js';

export interface FinanceSummary {
  totalIncomeInPaise: number;
  totalExpensesInPaise: number;
  netCashFlowInPaise: number;
  savingsRatePercentage: number;
  totalLoanOutstandingInPaise: number;
  totalMonthlyEMIInPaise: number;
  debtToIncomeRatioPercentage: number;
  formatted: {
    totalIncome: string;
    totalExpenses: string;
    netCashFlow: string;
    savingsRate: string;
    totalLoanOutstanding: string;
    totalMonthlyEMI: string;
    debtToIncomeRatio: string;
  };
}

export class FinanceService {
  /**
   * Deterministic calculation of User Financial Summary
   */
  static async calculateSummary(userId: string): Promise<FinanceSummary> {
    const transactions = await Transaction.find({ userId, isDeleted: false });
    const loans = await Loan.find({ userId, status: 'ACTIVE' });

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of transactions) {
      if (t.type === 'INCOME') {
        totalIncome += t.amountInPaise;
      } else if (t.type === 'EXPENSE') {
        totalExpenses += t.amountInPaise;
      }
    }

    const netCashFlow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 
      ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 100) / 100) 
      : 0;

    let totalLoanOutstanding = 0;
    let totalMonthlyEMI = 0;

    for (const l of loans) {
      totalLoanOutstanding += l.remainingBalanceInPaise;
      totalMonthlyEMI += l.monthlyEMIInPaise;
    }

    const debtToIncomeRatio = totalIncome > 0
      ? Math.round((totalMonthlyEMI / totalIncome) * 100 * 100) / 100
      : 0;

    return {
      totalIncomeInPaise: totalIncome,
      totalExpensesInPaise: totalExpenses,
      netCashFlowInPaise: netCashFlow,
      savingsRatePercentage: savingsRate,
      totalLoanOutstandingInPaise: totalLoanOutstanding,
      totalMonthlyEMIInPaise: totalMonthlyEMI,
      debtToIncomeRatioPercentage: debtToIncomeRatio,
      formatted: {
        totalIncome: formatINR(totalIncome),
        totalExpenses: formatINR(totalExpenses),
        netCashFlow: formatINR(netCashFlow),
        savingsRate: `${savingsRate.toFixed(2)}%`,
        totalLoanOutstanding: formatINR(totalLoanOutstanding),
        totalMonthlyEMI: formatINR(totalMonthlyEMI),
        debtToIncomeRatio: `${debtToIncomeRatio.toFixed(2)}%`
      }
    };
  }

  /**
   * Calculate EMI for a Loan using standard formula:
   * EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
   */
  static calculateEMI(principalRupees: number, annualRatePercent: number, tenureMonths: number): number {
    if (principalRupees <= 0 || tenureMonths <= 0) return 0;
    if (annualRatePercent <= 0) return Math.round(principalRupees / tenureMonths);

    const monthlyRate = annualRatePercent / 12 / 100;
    const emi = (principalRupees * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    
    return Math.round(emi);
  }

  /**
   * Calculate category spending breakdown
   */
  static async calculateCategoryBreakdown(userId: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') {
    const transactions = await Transaction.find({ userId, type, isDeleted: false });
    const categoryTotals: Record<string, number> = {};
    let grandTotal = 0;

    for (const t of transactions) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amountInPaise;
      grandTotal += t.amountInPaise;
    }

    return Object.entries(categoryTotals).map(([category, amountInPaise]) => ({
      category,
      amountInPaise,
      formattedAmount: formatINR(amountInPaise),
      percentage: grandTotal > 0 ? Math.round((amountInPaise / grandTotal) * 10000) / 100 : 0
    })).sort((a, b) => b.amountInPaise - a.amountInPaise);
  }
}
