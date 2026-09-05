import { db } from '@/lib/db';
import { created, route, parseJson } from '@/lib/api';
import { publicInquirySchema } from '@/lib/validation';
import { createInquiry } from '@/lib/inquiries';
import { clientIp, enforceRateLimit, pruneRateLimits } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/** One IP may send this many requests per hour. */
const RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 3600;

/**
 * POST /api/inquiries — the public request form.
 *
 * Records the request so the office has it even if the guest never follows up
 * on WhatsApp. Nothing is reserved and no availability is claimed; the office
 * replies and confirms by hand.
 */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req.headers);
  await enforceRateLimit(db, `inquiry:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS);

  const input = await parseJson(req, publicInquirySchema);

  const inquiry = await createInquiry(
    {
      serviceId: input.serviceId ?? null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      country: input.country ?? null,
      preferredStart: input.preferredStart || null,
      preferredEnd: input.preferredEnd || null,
      partySize: input.partySize ?? null,
      flightNumber: input.flightNumber ?? null,
      message: input.message ?? '',
      source: 'website',
    },
    db,
  );

  void pruneRateLimits(db).catch(() => {});

  // The guest gets back only their reference. Nothing else is theirs to see.
  return created({ reference: inquiry.reference });
});
