# Ahl Cairo — service site

Bilingual website for مكتب أهل كايرو, a VIP concierge office in Cairo serving
Gulf family travellers. It shows what the office offers and gets the guest
talking to the office. An internal dashboard collects every request so none is
lost.

Replaces the previous Bolt site, which had no way to capture or track enquiries.

---

## What this is, and what it is not

**It is** a service showcase with a request form and an office inbox.

**It is not** a booking engine. It quotes no prices, holds no inventory, and
reserves nothing. The office confirms availability and price itself, by phone
and WhatsApp, which is how the business actually runs.

That shapes every decision below:

| | |
|---|---|
| Prices | Nowhere in the system. Not a column, not a field, not a page. The office quotes each request. |
| Inventory | None. Ten families may ask about the same week; the office decides what it can serve. |
| A submitted request | A record and a callback, never a reservation. |
| Required fields | A name and a phone number. Nothing else, because asking for more costs real enquiries. |

A previous version of this repository did contain a full availability engine
with a Postgres exclusion constraint preventing double-booking. It was removed
when the office confirmed it does not hold sellable inventory. It is intact in
git history under the commit *"Add data model, availability engine and booking
API"* and can be restored if that changes.

---

## Getting started

Requires Node 20+ and PostgreSQL 14+ (the `pgcrypto` extension, which is
standard).

```bash
npm install
cp .env.example .env          # then fill it in
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
npm run db:seed     # refresh catalogue copy; safe to re-run
npm run db:reset    # drop and rebuild (refuses non-local databases)
```

---

## The site

**Public** — home, Airport Fast Track, chauffeured fleet, hotels and
apartments, about, and the request form. Arabic and English throughout, with a
real RTL layout rather than translated labels on a left-to-right page. Arabic is
the default locale. Both message files carry identical key sets and a test fails
if they drift.

Every service card lists what the package includes and ends in a request
button. WhatsApp and phone are one tap away from every page.

**Dashboard** — sign-in for staff and admin.

- **Inbox**: every request, with status counts doubling as one-click filters,
  and search across name, phone, reference and email.
- **Request detail**: the guest's message and travel details, WhatsApp and call
  buttons, follow-up actions, office notes, and a full history of who did what.
- **Log a request**: records one that arrived by phone or WhatsApp, so nothing
  lives only in a chat thread.
- **Services** (admin): show or hide a service on the public site.
- **Staff accounts** (admin): create, rename, reset a password, deactivate.

### Request statuses

`new` → `contacted` → `confirmed` → `closed`

Any status may follow any other. This is the office's to-do list, not a state
machine guarding money or inventory, so a request closed by mistake reopens in
one click. Whoever moves a request off `new` is recorded as following it up.

---

## Architecture

Next.js App Router, TypeScript, Tailwind, PostgreSQL via Kysely, `next-intl`.

```
db/migrations/     Plain SQL, forward-only, applied in filename order
db/catalogue.ts    The service catalogue, imported from the office's own site
src/lib/           Inquiry service, auth, validation, database
src/app/api/       Route handlers (public, staff, admin)
src/app/[locale]/  Public site and dashboard
messages/          ar.json and en.json — identical key sets
tests/             Integration tests against a real Postgres
```

**Dates** are `YYYY-MM-DD` strings from the database to the UI and back, never
`Date` objects. A `Date` in a UTC container shifts a Cairo calendar day by one.

**An inquiry keeps the service name as it stood** when the request arrived, so
the record still reads correctly after the catalogue is renamed, and survives
the service being deleted.

**Session tokens live in `src/lib/session-token.ts`**, separate from
`src/lib/auth.ts`. The middleware runs in the Edge Runtime and may only use Web
Crypto, so it must never reach the bcrypt in the auth module. Keep that split.

### Roles

| | Public site | Dashboard | Show/hide services | Staff accounts |
|---|---|---|---|---|
| Guest | browse, request | — | — | — |
| Staff | — | inbox, follow-up, log a request | — | — |
| Admin | — | everything | ✅ | ✅ |

Guests have no accounts. A request is tied to the name and phone typed on the
form, and the guest gets back only a reference number.

### Security

- Passwords hashed with bcrypt at cost 12.
- Sessions are signed JWTs in an httpOnly, SameSite=Lax cookie, 12-hour expiry.
- Every protected route re-reads the account from the database, so deactivating
  a staff member takes effect immediately rather than at token expiry.
- Rate limiting is stored in Postgres, so it holds across serverless instances
  where in-memory counters would give an attacker N times the allowance.
- Login failures are identical for a wrong password, an unknown email and a
  deactivated account, so the endpoint cannot enumerate staff.
- Every status change and note is written to `audit_logs` inside the same
  transaction as the change.
- The last active administrator cannot be removed, and an admin cannot lock
  themselves out.

---

## API

Public, no authentication:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/services?type=` | Catalogue |
| GET | `/api/services/:slug` | One service |
| POST | `/api/inquiries` | Records a request. Rate limited to 8 per IP per hour. Returns only a reference. |

Staff session required: `/api/staff/inquiries`, `/api/staff/inquiries/:id`.

Admin session required: `/api/admin/services`, `/api/admin/users`.

Responses are `{ "data": … }` or `{ "error": { "code", "message", "details" } }`.

---

## Content

`db/catalogue.ts` holds the service catalogue, imported from the office's
existing site. The Arabic is that site's own wording, kept verbatim. The English
is a translation of it.

Re-running `npm run db:seed` refreshes names, descriptions, inclusion lists,
categories and images. It never changes whether a service is visible, so a
service hidden in the dashboard stays hidden.

Two tests in `tests/catalogue.test.ts` fail if a price or an inventory count is
ever added back to the seed.

**Images** are the stock photographs the office already uses, served from
Pexels. They are hotlinked, so the site depends on that host staying available.
Worth self-hosting before go-live.

See `docs/DECISIONS.md` for what the office's existing site did and did not
publish.

---

## Tests

```bash
createdb ahlcairo_test
npm test
```

Against a real PostgreSQL, never a mock. Covers request capture with the minimum
fields, optional travel details, the service-name snapshot surviving a rename
and a deletion, concurrent submissions all being kept, the follow-up workflow
and its audit trail, inbox filtering and search agreeing on totals, rate
limiting, and authentication.

---

## Still to confirm

1. Hosting and domain target.
2. Whether the "+50 luxury cars" figure on the current site is accurate and
   whether it counts partner vehicles.
3. Whether the office wants an email or WhatsApp alert when a request arrives.
   Right now requests wait in the dashboard until someone looks.
