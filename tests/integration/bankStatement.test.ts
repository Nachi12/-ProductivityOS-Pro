import { describe, it, expect } from '../assert.js';
import { CSVStatementParser } from '../../src/services/parsers/csvStatementParser.js';

describe('Bank Statement Parser & Fingerprinting Pipeline', () => {
  it('parses CSV bank statement content and generates unique SHA-256 fingerprints', () => {
    const csvData = `Date,Description,Amount,Type,RefNo
2026-08-10,Salary Credit,100000,CREDIT,REF1001
2026-08-12,Swiggy Order,450,DEBIT,REF1002
2026-08-15,Amazon Electronics,2500,DEBIT,REF1003`;

    const parser = new CSVStatementParser();
    const transactions = parser.parseContent(csvData, 'user_test_123');

    expect(transactions.length).toBe(3);
    expect(transactions[0].type).toBe('INCOME');
    expect(transactions[0].amountInPaise).toBe(10000000); // ₹1,00,000
    expect(transactions[0].category).toBe('Salary');
    expect(transactions[1].category).toBe('Food & Dining');
    expect(transactions[2].category).toBe('Shopping');

    // SHA-256 fingerprints must exist and be 64-char hex strings
    expect(transactions[0].fingerprint).toHaveLength(64);
    expect(transactions[1].fingerprint).toHaveLength(64);
    expect(transactions[0].fingerprint).not.toBe(transactions[1].fingerprint);
  });
});
