import { BankStatement, IBankStatement } from '../models/BankStatement.js';
import { ImportBatch, IImportBatch } from '../models/ImportBatch.js';
import { Transaction, ITransaction } from '../models/Transaction.js';
import { CSVStatementParser } from './parsers/csvStatementParser.js';
import { ParsedStatementTransaction } from './parsers/baseParser.js';

export interface ProcessedStatementResult {
  statement: IBankStatement;
  parsedTransactions: (ParsedStatementTransaction & { isDuplicate: boolean })[];
  totalParsed: number;
  duplicateCount: number;
  newCount: number;
}

export class StatementService {
  /**
   * Parse uploaded bank statement & perform duplicate detection against DB
   */
  static async processStatement(
    userId: string,
    fileName: string,
    fileType: string,
    fileContent: string,
    fileSizeBytes: number
  ): Promise<ProcessedStatementResult> {
    const csvParser = new CSVStatementParser();
    const rawParsed = csvParser.parseContent(fileContent, userId);

    // Query existing fingerprints for user
    const fingerprints = rawParsed.map(t => t.fingerprint);
    const existingTxns = await Transaction.find({
      userId,
      fingerprint: { $in: fingerprints },
      isDeleted: false
    }).select('fingerprint');

    const existingFingerprints = new Set(existingTxns.map((t: any) => t.fingerprint));

    let duplicateCount = 0;
    const parsedTransactions = rawParsed.map(t => {
      const isDuplicate = existingFingerprints.has(t.fingerprint);
      if (isDuplicate) duplicateCount++;
      return { ...t, isDuplicate };
    });

    const statement = await BankStatement.create({
      userId,
      fileName,
      fileType,
      fileSizeBytes,
      bankName: 'GENERIC_STATEMENT',
      parsedTransactionCount: rawParsed.length,
      duplicateTransactionCount: duplicateCount,
      status: 'PARSED'
    });

    return {
      statement,
      parsedTransactions,
      totalParsed: rawParsed.length,
      duplicateCount,
      newCount: rawParsed.length - duplicateCount
    };
  }

  /**
   * Idempotent Transactional Import of confirmed statement transactions
   */
  static async importStatementTransactions(
    userId: string,
    statementId: string,
    transactionsToImport: ParsedStatementTransaction[]
  ) {
    const statement = await BankStatement.findOne({ _id: statementId, userId });
    if (!statement) {
      throw new Error('Bank statement record not found.');
    }

    let importedCount = 0;
    let totalAmountInPaise = 0;

    const batch = await ImportBatch.create({
      userId,
      statementId: statement._id as any,
      importedCount: 0,
      totalAmountInPaise: 0
    });

    for (const t of transactionsToImport) {
      // Re-verify duplicate to ensure idempotency
      const existing = await Transaction.findOne({ userId, fingerprint: t.fingerprint, isDeleted: false });
      if (existing) continue;

      await Transaction.create({
        userId,
        type: t.type,
        amountInPaise: t.amountInPaise,
        date: t.date,
        description: t.description,
        category: t.category,
        source: 'STATEMENT_IMPORT',
        referenceNumber: t.referenceNumber,
        statementId: statement._id as any,
        importBatchId: batch._id as any,
        fingerprint: t.fingerprint
      });

      importedCount++;
      totalAmountInPaise += t.amountInPaise;
    }

    (batch as any).importedCount = importedCount;
    (batch as any).totalAmountInPaise = totalAmountInPaise;
    await batch.save();

    (statement as any).importedTransactionCount = importedCount;
    (statement as any).status = 'IMPORTED';
    await statement.save();

    return {
      statement,
      importBatch: batch,
      importedCount,
      totalAmountInPaise
    };
  }

  /**
   * Safe Cascade Deletion of Bank Statement & its Batch-Imported Transactions
   */
  static async deleteStatement(userId: string, statementId: string) {
    const statement = await BankStatement.findOne({ _id: statementId, userId });
    if (!statement) {
      throw new Error('Bank statement not found.');
    }

    // Delete associated batch imported transactions safely
    const deleteResult = await Transaction.deleteMany({
      userId,
      statementId: statement._id as any,
      source: 'STATEMENT_IMPORT'
    });

    await ImportBatch.deleteMany({ userId, statementId: statement._id as any });
    await BankStatement.deleteOne({ _id: statement._id as any, userId });

    return {
      success: true,
      deletedTransactionsCount: deleteResult.deletedCount
    };
  }
}
