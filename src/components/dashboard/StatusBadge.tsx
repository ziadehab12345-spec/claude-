import { useTranslations } from 'next-intl';
import type { InquiryStatus } from '@/lib/schema';

const STYLE: Record<InquiryStatus, string> = {
  new: 'border-gold-500/50 bg-gold-400/15 text-gold-600',
  contacted: 'border-warning/40 bg-warning/10 text-warning',
  confirmed: 'border-success/40 bg-success/10 text-success',
  closed: 'border-ink-400/40 bg-ink-400/10 text-ink-600',
};

export function StatusBadge({ status }: { status: InquiryStatus }) {
  const t = useTranslations('inquiryStatus');
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap ${STYLE[status]}`}>
      {t(status)}
    </span>
  );
}
