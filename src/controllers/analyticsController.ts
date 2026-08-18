import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { FinanceService } from '../services/financeService.js';

export class AnalyticsController {
  static async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const summary = await FinanceService.calculateSummary(userId);
      const categoryBreakdown = await FinanceService.calculateCategoryBreakdown(userId, 'EXPENSE');

      res.json({
        success: true,
        data: {
          summary,
          categoryBreakdown
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'ANALYTICS_FAILED', message: err.message } });
    }
  }
}
