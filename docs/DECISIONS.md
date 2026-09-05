# Decision log

Facts, assumptions and decisions kept separate on purpose. An assumption is not
a decision. Nothing here was invented to fill a gap.

---

## Confirmed facts

- Business: مكتب أهل كايرو, a booking and reservations office in Cairo.
- Services: Airport VIP Fast Track (Classic, Golf Cart, VIP Personal), luxury
  car rental with a bilingual driver, partner five-star hotels, serviced
  apartments and penthouses.
- Positioning: private VIP concierge for Gulf family travellers. Privacy,
  security and bilingual staff, not a budget self-serve rental brand.
- Two booking channels: the customer books on the site, or staff enter a booking
  taken by WhatsApp or phone.
- Payment is offline only. Staff record payment status by hand. No gateway in v1.
- Arabic and English from day one, with real RTL and LTR layouts.
- The office holds its own inventory for cars, apartments **and** hotels, so all
  three need a real availability engine, not a referral queue.
- Catalogue: twelve car models across five categories; Four Seasons, Fairmont
  and Marriott Nile City; Zamalek and New Cairo apartments.
- Contact: +20 122 233 2929, Cairo.

## Decisions taken during the build

| # | Decision | Reasoning |
|---|---|---|
| 1 | Half-open date ranges, `[start, end)`, for every service type | Matches the hotel check-out convention and maps directly onto the Postgres `daterange` overlap operator. One rule, no per-type special cases. |
| 2 | Fast Track capacity modelled as N unit rows, not a counter | Lets every service share one availability engine and one database constraint. A second code path is a second place to get double-booking wrong. |
| 3 | Kysely with hand-written SQL migrations, not Prisma | Prisma cannot express the exclusion constraint or the generated column the business depends on, so its schema would drift and a future migration could drop the very constraint that prevents double-booking. |
| 4 | Money stored as integer minor units | Floating point must never touch a price. |
| 5 | Dates as `YYYY-MM-DD` strings end to end | A `Date` object in a UTC container shifts a Cairo calendar day by one. |
| 6 | `cancelled` and `completed` are terminal statuses | Re-opening a cancelled booking is not a state change: the dates were released and may already belong to someone else. Staff create a new booking, which goes through the availability check. |
| 7 | Rate limiting stored in Postgres | In-memory counters give an attacker N times the allowance on serverless, one bucket per instance. |
| 8 | Protected routes re-read the account from the database | An admin who deactivates a staff member expects it to take effect now, not at token expiry. |
| 9 | Seeded prices are zero and the UI shows "price on request" | No real price has been confirmed. Displaying a made-up number would be a false claim to a customer; displaying zero would be a wrong one. |
| 10 | Seeded units are named `PLACEHOLDER-n` | Real plates, room numbers and rep counts are unknown. The name makes it impossible to mistake them for real inventory, and the dashboard warns while any remain. |
| 11 | Arabic is the default locale | Egyptian office, Gulf customers. English is a full alternative, not a fallback. |
| 12 | The confirmation page shows only the reference | A guessed reference should reveal nothing. Full detail sits behind the lookup, which also requires the phone number on the booking. |
| 13 | Price overrides are admin-only | Staff record payment; they do not set amounts. The API discards a staff override rather than trusting the client. |

## Assumptions still standing

These were assumed to keep the build moving and are safe to change. Each is a
single edit, not a rewrite.

| Assumption | Where it lives | Cost to change |
|---|---|---|
| Currency is EGP | `services.currency`, defaulted per row | Low — the column already exists per service; multi-currency display would need a formatting pass. |
| Two roles, admin and staff | `user_role` enum | Low for another role, higher for per-resource permissions. |
| Cars bill per day, stays per night, Fast Track a flat fee | `computePrice` in `src/lib/bookings.ts` | Low. Seasonal or tiered pricing would need a rates table. |
| No automated notifications in v1 | — | Adding WhatsApp or email is additive; the booking service already has the hook point at creation and status change. |
| A booking may run up to 365 days | `MAX_BOOKING_DAYS` | Trivial. |
| Sessions last 12 hours | `SESSION_TTL_SECONDS` in `src/lib/auth.ts` | Trivial. |

## Still needs confirmation

Content and go-live blockers, not architecture blockers.

1. Real prices for every service.
2. Real unit counts: how many of each car, how many rooms per hotel, how many
   apartments per area, how many Fast Track representatives per day.
3. Hosting and domain target.
4. Cancellation and modification policy for a confirmed booking. The system
   currently allows staff to cancel at any point before completion, with no fee
   logic, because no policy has been given.
5. Whether prices should ever be shown in a currency other than EGP.
