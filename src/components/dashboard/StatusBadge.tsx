import { useTranslations } from 'next-intl';
import type { BookingStatus, PaymentStatus } from '@/lib/schema';

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: 'border-warning/40 bg-warning/10 text-warning',
  confirmed: 'border-success/40 bg-success/10 text-success',
  cancelled: 'border-ink-400/40 bg-ink-400/10 text-ink-600',
  completed: 'border-ink-700/30 bg-ink-700/10 text-ink-700',
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  unpaid: 'border-danger/40 bg-danger/10 text-danger',
  partial: 'border-warning/40 bg-warning/10 text-warning',
  paid: 'border-success/40 bg-success/10 text-success',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations('status');
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {t(status)}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('payment');
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap ${PAYMENT_STYLE[status]}`}>
      {t(status)}
    </span>
  );
}
