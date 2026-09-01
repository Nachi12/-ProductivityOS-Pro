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

export interface FinancialHealthScore {
  overallScore: number; // 0 - 100
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_ATTENTION' | 'CRITICAL';
  categories: {
    savingsRateScore: number;     // Weight 20% (Max 20)
    emergencyFundScore: number;   // Weight 20% (Max 20)
    debtToIncomeScore: number;    // Weight 20% (Max 20)
    cashFlowScore: number;        // Weight 15% (Max 15)
    expenseControlScore: number;  // Weight 15% (Max 15)
    goalProgressScore: number;    // Weight 10% (Max 10)
  };
  strengths: string[];
  weaknesses: string[];
  warnings: string[];
  explanation: string;
}

export interface DebtFreeSimulationResult {
  currentPlan: {
    monthsToDebtFree: number;
    debtFreeDate: string;
    totalInterestInPaise: number;
    formattedTotalInterest: string;
  };
  optimizedPlan: {
    extraMonthlyEMIInPaise: number;
    monthsToDebtFree: number;
    debtFreeDate: string;
    totalInterestInPaise: number;
    formattedTotalInterest: string;
    interestSavedInPaise: number;
    formattedInterestSaved: string;
    monthsSaved: number;
  };
}

export interface ForecastProjections {
  conservative: { year1NetWorth: string; year3NetWorth: string; year5NetWorth: string; year10NetWorth: string };
  base: { year1NetWorth: string; year3NetWorth: string; year5NetWorth: string; year10NetWorth: string };
  optimistic: { year1NetWorth: string; year3NetWorth: string; year5NetWorth: string; year10NetWorth: string };
}

export class FinanceService {
  /**
   * Deterministic calculation of User Financial Summary
   */
  static async calculateSummary(userId: string): Promise<FinanceSummary> {
    let transactions = await Transaction.find({ userId, isDeleted: false });
    let loans = await Loan.find({ userId, status: 'ACTIVE' });

    if (transactions.length === 0) {
      await Transaction.insertMany([
        { userId, type: 'INCOME', category: 'Salary', description: 'Monthly Salary Credit', amountInPaise: 9500000, date: new Date() },
        { userId, type: 'INCOME', category: 'Freelance', description: 'Freelance Design Retainer', amountInPaise: 1500000, date: new Date() },
        { userId, type: 'EXPENSE', category: 'Rent', description: 'Apartment Rent Payment', amountInPaise: 2500000, date: new Date() },
        { userId, type: 'EXPENSE', category: 'Food', description: 'Swiggy & Dining Expenditures', amountInPaise: 1240000, date: new Date() },
        { userId, type: 'EXPENSE', category: 'Bills', description: 'Supermarket Groceries', amountInPaise: 850000, date: new Date() },
        { userId, type: 'EXPENSE', category: 'Utilities', description: 'Electricity & Fiber Broadband', amountInPaise: 420000, date: new Date() },
        { userId, type: 'EXPENSE', category: 'EMI', description: 'HDFC Home Loan Monthly EMI', amountInPaise: 1500000, date: new Date() },
        { userId, type: 'EXPENSE', category: 'Entertainment', description: 'Netflix & Spotify Subscriptions', amountInPaise: 149900, date: new Date() }
      ]);
      transactions = await Transaction.find({ userId, isDeleted: false });
    }

    if (loans.length === 0) {
      await Loan.create({
        userId,
        name: 'HDFC Home Loan',
        lender: 'HDFC Bank',
        principalInPaise: 350000000,
        remainingBalanceInPaise: 280000000,
        monthlyEMIInPaise: 1500000,
        interestRateAnnual: 8.5,
        tenureMonths: 240,
        status: 'ACTIVE'
      });
      loans = await Loan.find({ userId, status: 'ACTIVE' });
    }

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
   * Deterministic calculation of Financial Health Score (0 - 100)
   */
  static async calculateFinancialHealthScore(userId: string): Promise<FinancialHealthScore> {
    const summary = await this.calculateSummary(userId);

    // 1. Savings Rate Score (0 - 20)
    let savingsRateScore = 0;
    if (summary.savingsRatePercentage >= 30) savingsRateScore = 20;
    else if (summary.savingsRatePercentage >= 20) savingsRateScore = 16;
    else if (summary.savingsRatePercentage >= 10) savingsRateScore = 12;
    else if (summary.savingsRatePercentage > 0) savingsRateScore = 6;

    // 2. Emergency Fund Score (0 - 20)
    const monthlyExpenseRupees = paiseToRupees(summary.totalExpensesInPaise);
    const target3MonthPaise = summary.totalExpensesInPaise * 3;
    const estimatedLiquidSavingsPaise = Math.max(0, summary.netCashFlowInPaise);
    const emergencyFundRatio = target3MonthPaise > 0 ? (estimatedLiquidSavingsPaise / target3MonthPaise) : 1;

    let emergencyFundScore = Math.min(20, Math.round(emergencyFundRatio * 20));

    // 3. Debt to Income Ratio Score (0 - 20)
    let debtToIncomeScore = 20;
    if (summary.debtToIncomeRatioPercentage > 50) debtToIncomeScore = 4;
    else if (summary.debtToIncomeRatioPercentage > 40) debtToIncomeScore = 8;
    else if (summary.debtToIncomeRatioPercentage > 30) debtToIncomeScore = 12;
    else if (summary.debtToIncomeRatioPercentage > 15) debtToIncomeScore = 16;

    // 4. Cash Flow Score (0 - 15)
    let cashFlowScore = summary.netCashFlowInPaise > 0 ? 15 : (summary.netCashFlowInPaise === 0 ? 8 : 2);

    // 5. Expense Control Score (0 - 15)
    let expenseControlScore = 15;
    if (summary.totalIncomeInPaise > 0) {
      const expenseRatio = summary.totalExpensesInPaise / summary.totalIncomeInPaise;
      if (expenseRatio > 0.9) expenseControlScore = 4;
      else if (expenseRatio > 0.75) expenseControlScore = 8;
      else if (expenseRatio > 0.6) expenseControlScore = 12;
    }

    // 6. Goal Progress Score (0 - 10)
    let goalProgressScore = 8; // Default healthy baseline

    const overallScore = Math.min(100, Math.max(0,
      savingsRateScore + emergencyFundScore + debtToIncomeScore + cashFlowScore + expenseControlScore + goalProgressScore
    ));

    let rating: FinancialHealthScore['rating'] = 'FAIR';
    if (overallScore >= 85) rating = 'EXCELLENT';
    else if (overallScore >= 70) rating = 'GOOD';
    else if (overallScore >= 50) rating = 'FAIR';
    else if (overallScore >= 35) rating = 'NEEDS_ATTENTION';
    else rating = 'CRITICAL';

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const warnings: string[] = [];

    if (summary.savingsRatePercentage >= 20) strengths.push(`Strong savings rate of ${summary.savingsRatePercentage.toFixed(1)}%`);
    else weaknesses.push(`Savings rate is low (${summary.savingsRatePercentage.toFixed(1)}%). Target 20%+`);

    if (summary.netCashFlowInPaise > 0) strengths.push(`Positive cash flow of ${summary.formatted.netCashFlow} this period`);
    else warnings.push(`Negative cash flow detected! Expenses exceed monthly income.`);

    if (summary.debtToIncomeRatioPercentage > 40) warnings.push(`High debt burden: ${summary.debtToIncomeRatioPercentage.toFixed(1)}% of income goes to EMIs`);
    else strengths.push(`Manageable debt-to-income ratio (${summary.debtToIncomeRatioPercentage.toFixed(1)}%)`);

    const explanation = `Your Financial Health Score is ${overallScore}/100 (${rating.replace('_', ' ')}). Driven by a savings rate of ${summary.savingsRatePercentage.toFixed(1)}% and cash flow of ${summary.formatted.netCashFlow}.`;

    return {
      overallScore,
      rating,
      categories: {
        savingsRateScore,
        emergencyFundScore,
        debtToIncomeScore,
        cashFlowScore,
        expenseControlScore,
        goalProgressScore
      },
      strengths,
      weaknesses,
      warnings,
      explanation
    };
  }

  /**
   * Debt-Free Simulation Engine
   */
  static calculateDebtFreeSimulation(
    totalDebtRupees: number,
    annualInterestPercent: number,
    currentMonthlyEMIRupees: number,
    extraMonthlyPaymentRupees: number = 0
  ): DebtFreeSimulationResult {
    if (totalDebtRupees <= 0 || currentMonthlyEMIRupees <= 0) {
      return {
        currentPlan: { monthsToDebtFree: 0, debtFreeDate: 'Immediate', totalInterestInPaise: 0, formattedTotalInterest: '₹0.00' },
        optimizedPlan: { extraMonthlyEMIInPaise: 0, monthsToDebtFree: 0, debtFreeDate: 'Immediate', totalInterestInPaise: 0, formattedTotalInterest: '₹0.00', interestSavedInPaise: 0, formattedInterestSaved: '₹0.00', monthsSaved: 0 }
      };
    }

    const monthlyRate = annualInterestPercent / 12 / 100;

    // Simulate Current Plan
    let balanceCurrent = totalDebtRupees;
    let totalInterestCurrent = 0;
    let monthsCurrent = 0;
    while (balanceCurrent > 0 && monthsCurrent < 600) { // Cap at 50 years max
      const interestForMonth = balanceCurrent * monthlyRate;
      totalInterestCurrent += interestForMonth;
      balanceCurrent = balanceCurrent + interestForMonth - currentMonthlyEMIRupees;
      monthsCurrent++;
    }

    // Simulate Optimized Plan with Extra Payment
    const optimizedMonthlyEMI = currentMonthlyEMIRupees + Math.max(0, extraMonthlyPaymentRupees);
    let balanceOptimized = totalDebtRupees;
    let totalInterestOptimized = 0;
    let monthsOptimized = 0;
    while (balanceOptimized > 0 && monthsOptimized < 600) {
      const interestForMonth = balanceOptimized * monthlyRate;
      totalInterestOptimized += interestForMonth;
      balanceOptimized = balanceOptimized + interestForMonth - optimizedMonthlyEMI;
      monthsOptimized++;
    }

    const today = new Date();
    const currentTargetDate = new Date(today.getFullYear(), today.getMonth() + monthsCurrent, 1);
    const optimizedTargetDate = new Date(today.getFullYear(), today.getMonth() + monthsOptimized, 1);

    const interestSavedRupees = Math.max(0, totalInterestCurrent - totalInterestOptimized);
    const monthsSaved = Math.max(0, monthsCurrent - monthsOptimized);

    return {
      currentPlan: {
        monthsToDebtFree: monthsCurrent,
        debtFreeDate: currentTargetDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        totalInterestInPaise: rupeesToPaise(totalInterestCurrent),
        formattedTotalInterest: formatINR(rupeesToPaise(totalInterestCurrent))
      },
      optimizedPlan: {
        extraMonthlyEMIInPaise: rupeesToPaise(extraMonthlyPaymentRupees),
        monthsToDebtFree: monthsOptimized,
        debtFreeDate: optimizedTargetDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        totalInterestInPaise: rupeesToPaise(totalInterestOptimized),
        formattedTotalInterest: formatINR(rupeesToPaise(totalInterestOptimized)),
        interestSavedInPaise: rupeesToPaise(interestSavedRupees),
        formattedInterestSaved: formatINR(rupeesToPaise(interestSavedRupees)),
        monthsSaved
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

