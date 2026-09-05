/**
 * Money is stored and computed in minor units (piastres) as integers.
 * Floating point never touches a price. Formatting for display is the only
 * place a decimal appears.
 */
export const DEFAULT_CURRENCY = 'EGP';

export function toMinor(value: string | number | bigint): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid money value: ${String(value)}`);
  return Math.round(n);
}

/** major-unit input (e.g. "1500.50" EGP) -> minor units (150050). */
export function majorToMinor(major: number): number {
  return Math.round(major * 100);
}

export function minorToMajor(minor: number): number {
  return minor / 100;
}

export function formatMoney(minor: number, currency = DEFAULT_CURRENCY, locale = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(minorToMajor(minor));
}
