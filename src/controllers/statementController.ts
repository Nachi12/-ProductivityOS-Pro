import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { StatementService } from '../services/statementService.js';
import { BankStatement } from '../models/BankStatement.js';

export class StatementController {
  static async uploadAndParse(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { fileName = 'statement.csv', fileType = 'text/csv', fileContent } = req.body;

      if (!fileContent) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE', message: 'Statement file content is required.' }
        });
      }

      const fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
      const result = await StatementService.processStatement(
        userId,
        fileName,
        fileType,
        fileContent,
        fileSizeBytes
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'STATEMENT_PROCESSING_FAILED', message: err.message } });
    }
  }

  static async importTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const id = req.params.id as string;
      const { transactions } = req.body;

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'Array of transactions to import is required.' }
        });
      }

      const result = await StatementService.importStatementTransactions(userId, id, transactions);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'IMPORT_FAILED', message: err.message } });
    }
  }

  static async listStatements(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const statements = await BankStatement.find({ userId }).sort({ createdAt: -1 });
      res.json({ success: true, data: { statements } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }

  static async deleteStatement(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const id = req.params.id as string;
      const result = await StatementService.deleteStatement(userId, id);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
    }
  }
}
