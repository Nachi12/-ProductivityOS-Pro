import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FinanceService } from '../services/financeService.js';

export class AnalyticsController {
  static async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const summary = await FinanceService.calculateSummary(userId);
      const healthScore = await FinanceService.calculateFinancialHealthScore(userId);
      const categoryBreakdown = await FinanceService.calculateCategoryBreakdown(userId, 'EXPENSE');

      res.json({
        success: true,
        data: {
          summary,
          healthScore,
          categoryBreakdown
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'ANALYTICS_FAILED', message: err.message } });
    }
  }

  static async simulateDebt(req: AuthenticatedRequest, res: Response) {
    try {
      const { totalDebtRupees = 500000, annualInterestPercent = 12, currentMonthlyEMIRupees = 15000, extraMonthlyPaymentRupees = 5000 } = req.body;
      const simulation = FinanceService.calculateDebtFreeSimulation(
        parseFloat(totalDebtRupees),
        parseFloat(annualInterestPercent),
        parseFloat(currentMonthlyEMIRupees),
        parseFloat(extraMonthlyPaymentRupees)
      );

      res.json({
        success: true,
        data: simulation
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SIMULATION_FAILED', message: err.message } });
    }
  }
}
