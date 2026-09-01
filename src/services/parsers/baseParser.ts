import crypto from 'crypto';
import { rupeesToPaise } from '../../utils/money.js';

export interface ParsedStatementTransaction {
  date: Date;
  description: string;
  amountInPaise: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  subcategory?: string;
  isEssential?: boolean;
  referenceNumber?: string;
  merchant?: string;
  fingerprint: string;
}

export abstract class BaseStatementParser {
  abstract parseContent(fileContent: string, userId: string): ParsedStatementTransaction[];

  /**
   * Generate robust SHA-256 fingerprint for transaction duplicate detection
   */
  protected generateFingerprint(
    userId: string,
    date: Date,
    amountInPaise: number,
    description: string,
    refNo: string = ''
  ): string {
    const isoDate = date.toISOString().split('T')[0];
    const normalizedDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '');
    const payload = `${userId}:${isoDate}:${amountInPaise}:${normalizedDesc}:${refNo}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Extract Merchant name from raw transaction string
   */
  protected extractMerchant(description: string): string {
    const desc = description.toUpperCase();
    if (desc.includes('SWIGGY')) return 'Swiggy';
    if (desc.includes('ZOMATO')) return 'Zomato';
    if (desc.includes('UBER')) return 'Uber';
    if (desc.includes('OLA')) return 'Ola';
    if (desc.includes('AMAZON')) return 'Amazon';
    if (desc.includes('FLIPKART')) return 'Flipkart';
    if (desc.includes('NETFLIX')) return 'Netflix';
    if (desc.includes('SPOTIFY')) return 'Spotify';
    if (desc.includes('SHELL') || desc.includes('PETROL') || desc.includes('IOCL') || desc.includes('BPCL')) return 'Fuel Station';
    return '';
  }

  /**
   * Determine if an expense is Essential (Needs) vs Discretionary (Wants)
   */
  protected determineEssential(category: string): boolean {
    const essentialCategories = ['Housing & Rent', 'Utilities', 'Healthcare', 'Groceries', 'EMI', 'Transportation'];
    return essentialCategories.includes(category);
  }

  /**
   * Categorize transaction based on keywords
   */
  protected autoCategorize(description: string, type: 'INCOME' | 'EXPENSE'): string {
    const desc = description.toLowerCase();
    
    if (type === 'INCOME') {
      if (desc.includes('salary') || desc.includes('payroll')) return 'Salary';
      if (desc.includes('dividend') || desc.includes('interest') || desc.includes('zerodha') || desc.includes('groww')) return 'Investments';
      if (desc.includes('freelance') || desc.includes('upwork') || desc.includes('stripe') || desc.includes('razorpay')) return 'Side Hustle';
      return 'Other Income';
    }

    if (desc.includes('swiggy') || desc.includes('zomato') || desc.includes('restaurant') || desc.includes('cafe') || desc.includes('food')) return 'Food & Dining';
    if (desc.includes('uber') || desc.includes('ola') || desc.includes('petrol') || desc.includes('fuel') || desc.includes('metro')) return 'Transportation';
    if (desc.includes('amazon') || desc.includes('flipkart') || desc.includes('myntra') || desc.includes('shopping')) return 'Shopping';
    if (desc.includes('electricity') || desc.includes('water') || desc.includes('broadband') || desc.includes('bill') || desc.includes('recharge')) return 'Utilities';
    if (desc.includes('rent') || desc.includes('society') || desc.includes('maintenance')) return 'Housing & Rent';
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('prime') || desc.includes('cinema') || desc.includes('pvr')) return 'Entertainment';
    if (desc.includes('apollo') || desc.includes('pharmacy') || desc.includes('hospital') || desc.includes('clinic')) return 'Healthcare';
    if (desc.includes('emi') || desc.includes('loan') || desc.includes('credit card payment')) return 'EMI & Loan';

    return 'Miscellaneous';
  }
}
