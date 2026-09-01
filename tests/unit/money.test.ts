import { describe, it, expect } from '../assert.js';
import { rupeesToPaise, paiseToRupees, formatINR } from '../../src/utils/money.js';

describe('Money Utilities (Paise & INR Formatting)', () => {
  it('correctly converts rupees to paise without floating-point errors', () => {
    expect(rupeesToPaise(100.50)).toBe(10050);
    expect(rupeesToPaise('₹1,000.75')).toBe(100075);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30); // Handled IEEE 754 precision!
  });

  it('correctly converts paise to rupees', () => {
    expect(paiseToRupees(10050)).toBe(100.5);
    expect(paiseToRupees(10000000)).toBe(100000);
  });

  it('formats numbers into Indian currency standard (Lakhs / Crores)', () => {
    expect(formatINR(10000000)).toBe('₹1,00,000.00');
    expect(formatINR(100000000)).toBe('₹10,00,000.00');
    expect(formatINR(-50000)).toBe('-₹500.00');
  });
});
