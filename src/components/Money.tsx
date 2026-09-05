import { formatMoney } from '@/lib/money';

/**
 * Renders a price, or an honest "on request" when no price has been set.
 *
 * A service seeded at zero has no confirmed price. Showing "EGP 0.00" to a
 * customer would be a false claim, so it is not shown at all.
 */
export function Money({
  minor,
  currency = 'EGP',
  locale = 'en',
  onRequestLabel,
}: {
  minor: number;
  currency?: string;
  locale?: string;
  onRequestLabel: string;
}) {
  if (!minor || minor <= 0) return <span className="text-ink-400">{onRequestLabel}</span>;
  return <span>{formatMoney(minor, currency, locale)}</span>;
}
