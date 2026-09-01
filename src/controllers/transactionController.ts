import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Transaction } from '../models/Transaction.js';
import { rupeesToPaise, paiseToRupees, formatINR } from '../utils/money.js';

export class TransactionController {
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { type, category, search, page = '1', limit = '20' } = req.query;

      const filter: any = { userId, isDeleted: false };
      if (type) filter.type = type;
      if (category) filter.category = category;
      if (search) {
        filter.description = { $regex: search as string, $options: 'i' };
      }

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [transactions, total] = await Promise.all([
        Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limitNum),
        Transaction.countDocuments(filter)
      ]);

      const formattedData = transactions.map(t => ({
        ...t.toObject(),
        amountRupees: paiseToRupees(t.amountInPaise),
        formattedAmount: formatINR(t.amountInPaise)
      }));

      res.json({
        success: true,
        data: {
          transactions: formattedData,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { type, amount, date, description, category, merchant, notes } = req.body;

      if (!type || !amount || !description || !category) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Type, amount, description, and category are required.' }
        });
      }

      const amountInPaise = rupeesToPaise(amount);
      const transaction = await Transaction.create({
        userId,
        type,
        amountInPaise,
        date: date ? new Date(date) : new Date(),
        description,
        category,
        merchant: merchant || '',
        notes: notes || '',
        source: 'MANUAL'
      });

      res.status(201).json({
        success: true,
        data: {
          transaction: {
            ...transaction.toObject(),
            amountRupees: paiseToRupees(transaction.amountInPaise),
            formattedAmount: formatINR(transaction.amountInPaise)
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { id } = req.params;

      const transaction = await Transaction.findOne({ _id: id, userId, isDeleted: false });
      if (!transaction) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found.' } });
      }

      if (req.body.amount !== undefined) {
        transaction.amountInPaise = rupeesToPaise(req.body.amount);
      }
      if (req.body.type) transaction.type = req.body.type;
      if (req.body.description) transaction.description = req.body.description;
      if (req.body.category) transaction.category = req.body.category;
      if (req.body.date) transaction.date = new Date(req.body.date);
      if (req.body.notes !== undefined) transaction.notes = req.body.notes;

      await transaction.save();

      res.json({
        success: true,
        data: {
          transaction: {
            ...transaction.toObject(),
            amountRupees: paiseToRupees(transaction.amountInPaise),
            formattedAmount: formatINR(transaction.amountInPaise)
          }
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.uid;
      const { id } = req.params;

      const transaction = await Transaction.findOne({ _id: id, userId });
      if (!transaction) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found.' } });
      }

      transaction.isDeleted = true;
      await transaction.save();

      res.json({ success: true, message: 'Transaction deleted successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }
}
