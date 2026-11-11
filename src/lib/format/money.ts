// Money as exact text, never floating point. Amounts are held as paise in a
// BigInt for any arithmetic. Safe to import in browser code.

const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

// Accepts what a person types, such as 1,500.5. Returns null if it is not a
// valid amount with at most two decimals.
export function parseAmountToPaise(input: string): bigint | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!AMOUNT_PATTERN.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function sumPaise(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, BigInt(0));
}

// Indian digit grouping (lakh and crore) with two decimals, from paise.
export function formatPaise(paise: bigint): string {
  const negative = paise < BigInt(0);
  const absolute = negative ? -paise : paise;
  const whole = (absolute / BigInt(100)).toString();
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${groupIndian(whole)}.${fraction}`;
}

// Formats an amount held as text, like "184300.50" from the database.
export function formatAmountText(text: string): string {
  const paise = parseAmountToPaise(text);
  return paise === null ? text : formatPaise(paise);
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

// YYYY-MM-DD to DD/MM/YYYY. Split as text so no timezone can shift the day.
export function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
