import { Router } from 'express';
import { AuthController } from '../../controllers/authController.js';
import { TransactionController } from '../../controllers/transactionController.js';
import { StatementController } from '../../controllers/statementController.js';
import { AnalyticsController } from '../../controllers/analyticsController.js';
import { AIController } from '../../controllers/aiController.js';
import { requireAuth } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// Health Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'FinanceOS Pro Financial API'
  });
});

// Authentication Routes
router.post('/auth/register', authRateLimiter, AuthController.register);
router.post('/auth/login', authRateLimiter, AuthController.login);
router.get('/auth/me', requireAuth, AuthController.me);

// Transaction Management Routes
router.get('/transactions', requireAuth, TransactionController.list);
router.post('/transactions', requireAuth, TransactionController.create);
router.patch('/transactions/:id', requireAuth, TransactionController.update);
router.delete('/transactions/:id', requireAuth, TransactionController.delete);

// Bank Statement Analyzer Routes
router.post('/statements/upload', requireAuth, StatementController.uploadAndParse);
router.get('/statements', requireAuth, StatementController.listStatements);
router.post('/statements/:id/import', requireAuth, StatementController.importTransactions);
router.delete('/statements/:id', requireAuth, StatementController.deleteStatement);

// Financial Analytics & Debt Simulation Routes
router.get('/analytics/summary', requireAuth, AnalyticsController.getSummary);
router.post('/analytics/simulate-debt', requireAuth, AnalyticsController.simulateDebt);

// AI Financial Copilot & Intelligence Routes
router.post('/ai/copilot', requireAuth, AIController.queryCopilot);
router.post('/ai/command', requireAuth, AIController.executeCommand);
router.post('/ai/explain-metric', requireAuth, AIController.explainMetric);
router.post('/ai/diagnosis', requireAuth, AIController.getDiagnosis);
router.post('/ai/wealth-path', requireAuth, AIController.calculateWealthPath);
router.get('/ai/insights', requireAuth, AIController.getInsights);
router.get('/ai/action-plan', requireAuth, AIController.getActionPlan);

export default router;
