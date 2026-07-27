/**
 * Converts a Naira amount into its written-out English form for the
 * "Amount in Words" line on a printed invoice — a standard fraud-prevention
 * convention (makes the figure unambiguous even if the numeric total were
 * altered or misread).
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function threeDigitsToWords(n: number): string {
  let words = '';
  if (n >= 100) {
    words += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n > 0) words += ' and ';
  }
  if (n >= 20) {
    words += TENS[Math.floor(n / 10)];
    if (n % 10 > 0) words += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    words += ONES[n];
  }
  return words;
}

function integerToWords(value: number): string {
  if (value === 0) return 'Zero';

  const chunks: number[] = [];
  let n = value;
  while (n > 0) {
    chunks.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  let words = '';
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i] === 0) continue;
    words += (words ? ' ' : '') + threeDigitsToWords(chunks[i]) + (SCALES[i] ? ` ${SCALES[i]}` : '');
  }
  return words;
}

export function amountToWords(amount: number, currencyName = 'Naira', minorUnitName = 'Kobo'): string {
  const whole = Math.floor(Math.abs(amount));
  const minorUnits = Math.round((Math.abs(amount) - whole) * 100);

  let result = `${integerToWords(whole)} ${currencyName}`;
  if (minorUnits > 0) {
    result += ` and ${threeDigitsToWords(minorUnits)} ${minorUnitName}`;
  }
  return `${result} Only`;
}
