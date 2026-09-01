import { AIContextService } from './aiContextService.js';
import { FinanceService } from '../financeService.js';
import { getAIProvider } from './aiProvider.js';

export interface FinancialDiagnosis {
  lifeStage: {
    stageNumber: number;
    stageName: 'Financial Recovery' | 'Financial Stability' | 'Financial Foundation' | 'Wealth Building' | 'Accelerated Wealth Building' | 'Financial Independence' | 'High Net Worth Management';
    description: string;
    nextMilestone: string;
  };
  financialStatus: string;
  topStrengths: string[];
  topProblems: string[];
  biggestRisks: string[];
  biggestOpportunities: string[];
  topActions: string[];
  plan30Day: string[];
  plan90Day: string[];
  year1Priorities: string[];
}

export class AIDiagnosisService {
  /**
   * Determine Financial Life Stage based on deterministic financial metrics
   */
  static determineLifeStage(savingsRate: number, netCashFlow: number, debtToIncome: number, healthScore: number) {
    if (netCashFlow < 0 || debtToIncome > 50) {
      return {
        stageNumber: 1,
        stageName: 'Financial Recovery' as const,
        description: 'Focus is on stopping cash flow leaks and stabilizing high-cost debt service.',
        nextMilestone: 'Achieve positive net cash flow and reduce Debt-to-Income below 45%.'
      };
    }
    if (savingsRate < 10) {
      return {
        stageNumber: 2,
        stageName: 'Financial Stability' as const,
        description: 'Basic stability achieved. Goal is building 1-month liquid cash buffer.',
        nextMilestone: 'Increase monthly savings rate to 15%+.'
      };
    }
    if (savingsRate < 20) {
      return {
        stageNumber: 3,
        stageName: 'Financial Foundation' as const,
        description: 'Foundation building underway. Reserve funds and moderate debt service.',
        nextMilestone: 'Complete 3-6 month emergency reserve buffer.'
      };
    }
    if (healthScore < 80) {
      return {
        stageNumber: 4,
        stageName: 'Wealth Building' as const,
        description: 'Healthy surplus cash flow. Systematic capital accumulation in progress.',
        nextMilestone: 'Reach 20%+ savings rate and accelerate debt elimination.'
      };
    }
    if (healthScore < 90) {
      return {
        stageNumber: 5,
        stageName: 'Accelerated Wealth Building' as const,
        description: 'High financial efficiency with multi-asset growth velocity.',
        nextMilestone: 'Scale investment compounding towards long-term target portfolio.'
      };
    }
    if (healthScore < 95) {
      return {
        stageNumber: 6,
        stageName: 'Financial Independence' as const,
        description: 'Investment returns can cover core living expenses.',
        nextMilestone: 'Optimize tax strategies and asset protection.'
      };
    }

    return {
      stageNumber: 7,
      stageName: 'High Net Worth Management' as const,
      description: 'Capital preservation, estate planning, and generational wealth scaling.',
      nextMilestone: 'Maintain risk diversification and estate structuring.'
    };
  }

  /**
   * Generate 1-Click Financial Diagnosis ("Analyze My Finances")
   */
  static async diagnoseFinances(userId: string): Promise<FinancialDiagnosis> {
    const context = await AIContextService.generateSummarizedContext(userId);
    const summary = await FinanceService.calculateSummary(userId);
    const provider = getAIProvider();

    const lifeStage = this.determineLifeStage(
      summary.savingsRatePercentage,
      summary.netCashFlowInPaise,
      summary.debtToIncomeRatioPercentage,
      context.healthScore.overallScore
    );

    const prompt = `Analyze this financial context and provide a structured diagnosis.
Life Stage: Stage ${lifeStage.stageNumber} - ${lifeStage.stageName}.
Summary: Income=${context.summary.totalIncome}, Expenses=${context.summary.totalExpenses}, SavingsRate=${context.summary.savingsRate}, HealthScore=${context.healthScore.overallScore}/100.
Top Categories: ${JSON.stringify(context.topCategories)}`;

    const systemContext = `You are an expert AI Financial Doctor. Diagnose user finances accurately without hallucinating numbers. Focus on real context data.`;
    const aiResponse = await provider.completion(prompt, systemContext);

    return {
      lifeStage,
      financialStatus: `Diagnosed at Stage ${lifeStage.stageNumber}: ${lifeStage.stageName}. ${aiResponse.slice(0, 180)}...`,
      topStrengths: context.healthScore.strengths.length > 0 ? context.healthScore.strengths : ['Positive net cash flow maintained', 'Controlled expense structure'],
      topProblems: context.healthScore.weaknesses.length > 0 ? context.healthScore.weaknesses : ['Savings rate below 20% benchmark'],
      biggestRisks: context.healthScore.warnings.length > 0 ? context.healthScore.warnings : ['Elevated discretionary dining expenditure'],
      biggestOpportunities: ['Automate 20% payday savings transfer', 'Accelerate debt payoff with ₹2,000 extra EMI'],
      topActions: [
        'Pause non-essential food delivery orders',
        'Setup automated liquid reserve transfer',
        'Simulate debt payoff acceleration in Debt tab'
      ],
      plan30Day: [
        'Audit Swiggy & restaurant charges from last month',
        'Build ₹10,000 liquid emergency reserve'
      ],
      plan90Day: [
        'Reach 20% monthly savings rate benchmark',
        'Eliminate lowest balance debt account'
      ],
      year1Priorities: [
        'Complete 3-month liquid emergency fund',
        'Increase net worth by 15%+'
      ]
    };
  }
}
