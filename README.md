# Ahl Cairo Booking Platform

Booking platform for مكتب أهل كايرو — a public bilingual website where customers
request a booking, and an internal dashboard where the office confirms bookings,
records payment and enters bookings taken by phone or WhatsApp.

Replaces the previous Bolt site, which had no availability engine and no
dashboard.

---

## The one rule everything else serves

**A unit can never hold two overlapping active bookings, whatever the channel.**

That rule is enforced in three places, deliberately:

| Layer | What it does | File |
|---|---|---|
| Database | `EXCLUDE USING gist` constraint on `bookings`, scoped to `pending` and `confirmed` | `db/migrations/0001_init.sql` |
| Service | Locks the unit row, checks availability, translates a constraint violation into a clean error | `src/lib/bookings.ts` |
| API / UI | Offers only units the server said were free | `src/lib/availability.ts` |

The database is the one that actually guarantees it. The other two exist to give
a good error message. A direct `INSERT` that bypasses every line of application
code is still rejected, and there is a test that proves it.

Availability is deterministic SQL. No AI, no heuristic, no client-side filtering.

### Date semantics

Every range is half-open: `[start_date, end_date)`.

| Service | start_date | end_date |
|---|---|---|
| Hotel, apartment | Check-in | Check-out — free for the next guest |
| Car | Pickup day | Return day |
| Fast Track | Flight date | Always start + 1 day |

A three-night stay is `2026-10-01 → 2026-10-04`. The guest checking out on the
4th does not block the guest arriving on the 4th. This is the standard hotel
convention and it is what the `daterange(start, end, '[)')` overlap operator
gives for free.

Fast Track capacity is modelled as N unit rows, one per representative slot, so
it uses the same engine and the same constraint as everything else rather than a
parallel capacity counter.

---

## Getting started

Requires Node 20+ and PostgreSQL 14+ (`btree_gist` and `pgcrypto` extensions,
both standard).

```bash
npm install
cp .env.example .env          # then fill it in — see below
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `TEST_DATABASE_URL` | for tests | A separate database — the suite truncates it |
| `AUTH_SECRET` | yes | 32+ characters. `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | yes | No trailing slash |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | first seed only | Creates the first admin. Change the password after signing in. |

Never commit `.env`.

### Commands

```bash
npm run dev         # development server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm test            # integration tests against TEST_DATABASE_URL
npm run db:migrate  # apply pending migrations
npm run db:seed     # add missing catalogue rows; safe to re-run
npm run db:reset    # drop and rebuild (refuses non-local databases)
```

---

## Before go-live

The seed loads the catalogue imported from the office's existing site: three
Fast Track tiers with their advertised inclusions, twelve car models in five
categories, three hotel partners, Zamalek and New Cairo apartments, and
Executive VIP studios. Arabic copy is that site's own wording.

That site publishes **no prices and no inventory counts**, so the seed does not
invent them:

1. **Prices.** Every service is seeded at zero. The public site shows
   "price on request" rather than a fabricated or zero amount. An admin sets
   real prices under Dashboard → Inventory.
2. **Unit counts.** Each service gets `PLACEHOLDER-n` units. The only figure
   the existing site gives is a fleet-wide "+50 luxury cars", which says nothing
   about how many of any given model exist. Replace them with real plates, room
   numbers and rep slots. The inventory screen warns while any placeholder
   remains.

`tests/catalogue.test.ts` fails if a price or a real-looking inventory count is
ever added to the seed. See `docs/DECISIONS.md` for exactly what the existing
site did and did not contain.

Still open, none of which blocks development:

- Exact unit counts per model, room counts per hotel, Fast Track reps per day
- Hosting and domain target
- Cancellation and modification policy for a confirmed booking
- Currency (EGP is assumed throughout; prices are stored in minor units)

---

## Architecture

Next.js App Router, TypeScript, Tailwind, PostgreSQL via Kysely, `next-intl`.

```
db/migrations/     Plain SQL, forward-only, applied in filename order
src/lib/           Availability engine, booking service, auth, validation
src/app/api/       Route handlers (public, staff, admin)
src/app/[locale]/  Public site and dashboard
messages/          ar.json and en.json — identical key sets
tests/             Integration tests against a real Postgres
```

**Why Kysely and not Prisma.** The core of this system is a Postgres exclusion
constraint over a generated `daterange` column. Prisma cannot express either, so
its generated schema would permanently drift from the schema the business
depends on, and every future migration would risk dropping the constraint that
prevents double-booking. Kysely gives full type safety without owning the
schema. `src/lib/schema.ts` is the hand-written database interface; keep it in
sync with the migrations.

**Money** is stored as integer minor units (piastres). Floating point never
touches a price.

**Dates** are `YYYY-MM-DD` strings from the database to the UI and back, never
`Date` objects. A `Date` in a UTC container shifts a Cairo calendar day by one,
and that would silently misprice and misbook.

### Roles

| | Public site | Dashboard | Prices | Staff accounts |
|---|---|---|---|---|
| Customer | browse, submit | — | — | — |
| Staff | — | bookings, calendar, manual entry, payment status | view | — |
| Admin | — | everything | edit | manage |

Customers have no accounts. A booking is tied to the name, phone and email typed
at checkout, and the lookup page requires the reference *and* the phone number
so a guessed reference reveals nothing.

### Security

- Passwords hashed with bcrypt at cost 12.
- Sessions are signed JWTs in an httpOnly, SameSite=Lax cookie, 12-hour expiry.
- Every protected route re-reads the account from the database, so deactivating
  a staff member takes effect immediately rather than at token expiry.
- Rate limiting is stored in Postgres, so it holds across serverless instances
  where in-memory counters would give an attacker N times the allowance.
- Login failures are identical for a wrong password, an unknown email and a
  deactivated account, so the endpoint cannot enumerate staff.
- Every status change and price override is written to `audit_logs` inside the
  same transaction as the change.

---

## API

Public, no authentication:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/services?type=` | Catalogue |
| GET | `/api/services/:slug` | One service with its units |
| GET | `/api/availability?serviceSlug=&startDate=&endDate=` | Free units and the price |
| POST | `/api/bookings` | Creates a `pending` booking. Rate limited. Price comes from the catalogue, never the request. |
| GET | `/api/bookings/lookup?reference=&phone=` | Both must match |

Staff session required: `/api/staff/bookings`, `/api/staff/bookings/:id`,
`/api/staff/bookings/:id/status`, `/api/staff/calendar`, `/api/staff/blocks`.

Admin session required: `/api/admin/services`, `/api/admin/units`,
`/api/admin/users`.

Responses are `{ "data": … }` or `{ "error": { "code", "message", "details" } }`.
`409` means the dates were taken; re-check availability rather than retrying.

---

## Tests

```bash
createdb ahlcairo_test
npm test
```

They run against a real PostgreSQL, never a mock. The guarantee being tested is
a database constraint — a mocked database would test the mock and pass happily
while production double-books a Maybach.

Covered: overlap rejection in every direction, the check-out day staying free,
cancellation releasing dates, twelve concurrent transactions racing for one unit
with exactly one winner, a direct SQL bypass attempt, blocks, per-type pricing,
status transitions, audit entries, and authentication.

---

## Not in v1

Online payment (offline cash and transfer only, recorded by staff), automated
WhatsApp and SMS notifications, multi-branch support, customer accounts.
