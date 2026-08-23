/**
 * Token amount helpers. $PRENA amounts move through the system as base-unit
 * strings (uint256 semantics) and are only converted to display units at the
 * edges. Never use a JS number for a base-unit amount.
 */

export function toBaseUnits(display: string | number, decimals: number): bigint {
  const raw = typeof display === 'number' ? display.toString() : display.trim();
  if (!/^\d*(\.\d*)?$/.test(raw) || raw === '' || raw === '.') {
    throw new Error('invalid_amount');
  }
  const [whole, fraction = ''] = raw.split('.');
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(`${whole || '0'}${padded || ''}` || '0');
}

export function fromBaseUnits(base: bigint | string, decimals: number): string {
  const value = typeof base === 'bigint' ? base : BigInt(base || '0');
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals > 0 ? digits.slice(digits.length - decimals).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** 12,842 — whole tokens, grouped. The product never shows 18 decimals. */
export function formatTokenAmount(
  base: bigint | string,
  decimals: number,
  options: { maximumFractionDigits?: number } = {},
): string {
  const display = fromBaseUnits(base, decimals);
  const asNumber = Number(display);
  if (!Number.isFinite(asNumber)) return display;
  const max = options.maximumFractionDigits ?? (asNumber >= 1000 || Number.isInteger(asNumber) ? 0 : 2);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(asNumber);
}

/** Formats a display-unit decimal string (reward amounts are stored this way). */
export function formatDisplayAmount(value: string | number, maximumFractionDigits = 0): string {
  const asNumber = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(asNumber)) return '0';
  const max = Number.isInteger(asNumber) ? maximumFractionDigits : Math.max(maximumFractionDigits, 2);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(asNumber);
}

/**
 * Parses a base-unit amount that came from the database or an API.
 *
 * It throws on anything that is not a plain digit string. That strictness is
 * deliberate: PostgREST returns Postgres `numeric` as a JavaScript number,
 * which silently mangles uint256 values into forms like "2.407e+21". Coercing
 * such a value would compare a payment against a nonsense amount, so base-unit
 * columns are stored as text and anything else is treated as a bug.
 */
export function parseBaseUnits(value: unknown): bigint {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!/^\d+$/.test(raw)) {
    throw new Error(`invalid_base_units: ${raw}`);
  }
  return BigInt(raw);
}

/** Same parse, but yields null instead of throwing. For display paths only. */
export function tryParseBaseUnits(value: unknown): bigint | null {
  try {
    return parseBaseUnits(value);
  } catch {
    return null;
  }
}

export function compareBase(a: bigint | string, b: bigint | string): number {
  const left = typeof a === 'bigint' ? a : BigInt(a || '0');
  const right = typeof b === 'bigint' ? b : BigInt(b || '0');
  return left === right ? 0 : left > right ? 1 : -1;
}

/** Applies a whole-percent discount to a USD cents amount, rounding half up. */
export function applyDiscountCents(cents: number, discountPercent: number): number {
  const clamped = Math.min(90, Math.max(0, Math.round(discountPercent)));
  return Math.round((cents * (100 - clamped)) / 100);
}
