/**
 * Money Handling Utilities
 * 
 * Stores monetary amounts internally as integer minor units (paise)
 * to avoid floating-point representation & rounding drift.
 * ₹1.00 = 100 paise
 */

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    // Remove currency symbols, commas, and whitespace
    rupees = parseFloat(rupees.replace(/[^0-9.-]/g, '')) || 0;
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Format paise into Indian Currency System (e.g. ₹10,00,000.00)
 */
export function formatINR(paise: number, includeDecimals = true): string {
  const rupees = paiseToRupees(paise);
  const isNegative = rupees < 0;
  const absRupees = Math.abs(rupees);
  
  const parts = absRupees.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Apply Indian numbering format (3 digits for thousand, then groups of 2)
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  const formatted = includeDecimals 
    ? `₹${integerPart}.${decimalPart}` 
    : `₹${integerPart}`;

  return isNegative ? `-${formatted}` : formatted;
}
