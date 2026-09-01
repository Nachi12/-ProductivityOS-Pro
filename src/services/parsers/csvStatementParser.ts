import { BaseStatementParser, ParsedStatementTransaction } from './baseParser.js';
import { rupeesToPaise } from '../../utils/money.js';

export class CSVStatementParser extends BaseStatementParser {
  parseContent(fileContent: string, userId: string): ParsedStatementTransaction[] {
    const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: ParsedStatementTransaction[] = [];

    if (lines.length < 2) return parsed;

    // Detect header row index
    let startLine = 0;
    const headerLine = lines[0].toLowerCase();
    if (headerLine.includes('date') || headerLine.includes('amount') || headerLine.includes('description')) {
      startLine = 1;
    }

    for (let i = startLine; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
      if (row.length < 3) continue;

      let dateStr = row[0];
      let descStr = row[1];
      let amountStr = row[2];
      let typeStr = row[3] ? row[3].toUpperCase() : '';
      let refNo = row[4] || '';

      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) continue;

      const rawAmount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
      if (rawAmount === 0) continue;

      let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
      if (typeStr.includes('DEBIT') || typeStr.includes('DR')) {
        type = 'EXPENSE';
      } else if (typeStr.includes('CREDIT') || typeStr.includes('CR') || rawAmount > 0) {
        type = 'INCOME';
      }

      const amountInPaise = rupeesToPaise(Math.abs(rawAmount));
      const category = this.autoCategorize(descStr, type);
      const fingerprint = this.generateFingerprint(userId, parsedDate, amountInPaise, descStr, refNo);

      parsed.push({
        date: parsedDate,
        description: descStr,
        amountInPaise,
        type,
        category,
        referenceNumber: refNo,
        fingerprint
      });
    }

    return parsed;
  }
}
