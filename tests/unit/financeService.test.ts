import { describe, it, expect } from '../assert.js';
import { FinanceService } from '../../src/services/financeService.js';

describe('Finance Service Calculations', () => {
  it('calculates EMI accurately using standard loan formula', () => {
    // ₹10,00,000 at 8.5% for 120 months (10 years)
    const emi = FinanceService.calculateEMI(1000000, 8.5, 120);
    expect(emi).toBeGreaterThan(12300);
    expect(emi).toBeLessThan(12500);
  });

  it('returns 0 EMI for invalid principal or tenure', () => {
    expect(FinanceService.calculateEMI(0, 10, 12)).toBe(0);
    expect(FinanceService.calculateEMI(1000, 10, 0)).toBe(0);
  });
});
