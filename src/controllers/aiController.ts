import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AICopilotService } from '../services/aiCopilotService.js';

export class AIController {
  static async queryCopilot(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { query = 'Where is my money going?' } = req.body;
      const result = await AICopilotService.processCopilotQuery(userId, query);

      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'AI_QUERY_FAILED', message: err.message } });
    }
  }

  static async getInsights(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const insights = await AICopilotService.generateInsights(userId);

      res.json({
        success: true,
        data: { insights }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'AI_INSIGHTS_FAILED', message: err.message } });
    }
  }

  static async executeCommand(req: AuthenticatedRequest, res: Response) {
    try {
      const { query = '' } = req.body;
      const intent = await AICopilotService.parseCommand(query);

      res.json({
        success: true,
        data: intent
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'COMMAND_PARSING_FAILED', message: err.message } });
    }
  }

  static async explainMetric(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { metric = 'health_score' } = req.body;
      const result = await AICopilotService.explainMetric(userId, metric);

      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'EXPLAIN_METRIC_FAILED', message: err.message } });
    }
  }

  static async getActionPlan(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const actionPlan = await AICopilotService.generateActionPlan(userId);

      res.json({
        success: true,
        data: { actionPlan }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'ACTION_PLAN_FAILED', message: err.message } });
    }
  }

  static async getDiagnosis(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { AIDiagnosisService } = await import('../services/ai/aiDiagnosisService.js');
      const diagnosis = await AIDiagnosisService.diagnoseFinances(userId);

      res.json({
        success: true,
        data: diagnosis
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'DIAGNOSIS_FAILED', message: err.message } });
    }
  }

  static async calculateWealthPath(req: AuthenticatedRequest, res: Response) {
    try {
      const { currentNetWorthRupees = 500000, targetNetWorthRupees = 10000000, monthlyInvestmentRupees = 25000, annualReturnRatePercent = 12 } = req.body;
      const { WealthPathService } = await import('../services/ai/wealthPathService.js');
      const result = WealthPathService.calculateWealthPath(
        parseFloat(currentNetWorthRupees),
        parseFloat(targetNetWorthRupees),
        parseFloat(monthlyInvestmentRupees),
        parseFloat(annualReturnRatePercent)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'WEALTH_PATH_FAILED', message: err.message } });
    }
  }
}
