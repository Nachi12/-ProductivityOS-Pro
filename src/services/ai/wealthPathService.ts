import { FinanceService } from '../financeService.js';
import { formatINR } from '../../utils/money.js';

export interface WealthPathResult {
  targetNetWorthRupees: number;
  currentNetWorthRupees: number;
  monthlyInvestmentRupees: number;
  annualReturnRatePercent: number;
  estimatedMonthsToTarget: number;
  estimatedYearsToTarget: number;
  formattedTarget: string;
  formattedCurrent: string;
  formattedMonthlyInvestment: string;
  aiPathExplanation: string;
}

export class WealthPathService {
  /**
   * Deterministic compounding calculation for ₹1 Crore / Custom Net Worth Goal
   */
  static calculateWealthPath(
    currentNetWorthRupees: number,
    targetNetWorthRupees: number = 10000000,
    monthlyInvestmentRupees: number = 25000,
    annualReturnRatePercent: number = 12
  ): WealthPathResult {
    const monthlyRate = annualReturnRatePercent / 100 / 12;
    let balance = currentNetWorthRupees;
    let months = 0;
    const maxMonths = 600; // 50 years max guard

    while (balance < targetNetWorthRupees && months < maxMonths) {
      balance = balance * (1 + monthlyRate) + monthlyInvestmentRupees;
      months++;
    }

    const years = (months / 12).toFixed(1);

    const aiPathExplanation = `Investing ${formatINR(Math.round(monthlyInvestmentRupees * 100))}/month at an assumed ${annualReturnRatePercent}% annual return projects reaching your ${formatINR(Math.round(targetNetWorthRupees * 100))} milestone in approximately ${years} years (${months} months). Maintaining consistent monthly contributions and reinvesting gains drives compound growth velocity.`;

    return {
      targetNetWorthRupees,
      currentNetWorthRupees,
      monthlyInvestmentRupees,
      annualReturnRatePercent,
      estimatedMonthsToTarget: months,
      estimatedYearsToTarget: parseFloat(years),
      formattedTarget: formatINR(Math.round(targetNetWorthRupees * 100)),
      formattedCurrent: formatINR(Math.round(currentNetWorthRupees * 100)),
      formattedMonthlyInvestment: formatINR(Math.round(monthlyInvestmentRupees * 100)),
      aiPathExplanation
    };
  }
}
