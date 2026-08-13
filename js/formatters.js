// js/formatters.js

/**
 * Formats a raw number string into Indian numbering system format.
 * Example: 100000 -> 1,00,000
 * @param {string} value Raw input string
 * @returns {string} Formatted string
 */
export function formatIndianCurrency(value) {
    if (!value) return '';
    // Strip non-numeric characters except period and minus
    let raw = value.toString().replace(/[^\d.-]/g, '');
    if (!raw) return '';

    const parts = raw.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1].substring(0, 2) : '';

    const isNegative = integerPart.startsWith('-');
    if (isNegative) integerPart = integerPart.substring(1);

    let lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    
    if (otherNumbers !== '') {
        lastThree = ',' + lastThree;
    }
    
    let formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

    return (isNegative ? '-' : '') + formattedInteger + decimalPart;
}

/**
 * Attaches dynamic Indian currency formatting to an input element.
 * @param {HTMLInputElement} inputEl The input element
 * @param {Function} onChange Optional callback when value changes
 */
export function attachCurrencyFormatter(inputEl, onChange = null) {
    if (!inputEl) return;

    // Change type from number to text to allow commas
    if (inputEl.type === 'number') {
        inputEl.type = 'text';
    }

    const updateDisplay = () => {
        const rawValue = inputEl.value;
        const formatted = formatIndianCurrency(rawValue);
        inputEl.value = formatted;
        
        // Store raw value
        const cleanNumber = parseFloat(formatted.replace(/,/g, ''));
        inputEl.dataset.rawValue = isNaN(cleanNumber) ? '' : cleanNumber;

        if (onChange) onChange(cleanNumber);
    };

    inputEl.addEventListener('input', (e) => {
        // Save cursor position relative to the end
        const cursorPosition = inputEl.value.length - (inputEl.selectionStart || 0);
        
        updateDisplay();

        // Restore cursor position
        const newCursorPosition = Math.max(0, inputEl.value.length - cursorPosition);
        inputEl.setSelectionRange(newCursorPosition, newCursorPosition);
    });

    inputEl.addEventListener('blur', () => {
        const rawValue = inputEl.value.replace(/,/g, '');
        if (rawValue) {
            const num = parseFloat(rawValue);
            if (!isNaN(num)) {
                // Formatting back to nice string if they just typed 100000
                inputEl.value = formatIndianCurrency(num.toString());
                inputEl.dataset.rawValue = num;
            }
        }
    });

    // Initial formatting if value exists
    if (inputEl.value) {
        updateDisplay();
    }
}

export function getRawValue(inputEl) {
    if (!inputEl) return 0;
    const raw = parseFloat(inputEl.dataset.rawValue || inputEl.value.replace(/,/g, ''));
    return isNaN(raw) ? 0 : raw;
}
