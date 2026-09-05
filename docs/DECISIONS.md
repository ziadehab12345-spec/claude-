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

## Scope change — September 2026

The office confirmed it does not want to publish prices and does not hold
per-unit inventory to sell. The product is therefore a **service showcase with
a contact flow**, not a booking platform.

The availability engine built earlier — a Postgres `EXCLUDE USING gist`
constraint that made double-booking impossible, with 38 tests behind it — was
removed rather than left in place unused. Dead machinery is a maintenance
liability and a false promise to whoever reads the code next. It is intact in
git history under *"Add data model, availability engine and booking API"* and
restorable if the office later holds its own allotment.

## Decisions taken during the build

| # | Decision | Reasoning |
|---|---|---|
| 1 | A request is a record and a callback, never a reservation | The office confirms availability itself. Any hint of a held date on the public site would be a promise the system cannot keep. |
| 2 | Only a name and a phone number are required | That is all the office needs to call back. Every extra required field costs real enquiries. |
| 3 | Requests are stored, not just handed to WhatsApp | A WhatsApp-only button loses every guest who does not complete the handoff, and leaves the office no record, no follow-up list and nothing to measure. |
| 4 | WhatsApp and phone sit beside the form on every page | Most Gulf guests prefer to message. The form is for the ones who do not, not a toll gate in front of the office. |
| 5 | Any inquiry status may follow any other | This is the office's to-do list, not a state machine guarding money or inventory. One closed by mistake should reopen in one click. |
| 6 | An inquiry snapshots the service name at the time it arrived | So the record still reads correctly after the catalogue is renamed, and survives the service being deleted. |
| 7 | Dates on a request are optional and unvalidated against any calendar | They are a preference. Many guests may ask about the same week. |
| 8 | No price exists anywhere in the system | Not a column, not a field. A price that lives nowhere cannot be shown by accident or drift from what the office actually charges. |
| 9 | Dates as `YYYY-MM-DD` strings end to end | A `Date` object in a UTC container shifts a Cairo calendar day by one. |
| 10 | Rate limiting stored in Postgres | In-memory counters give an attacker N times the allowance on serverless, one bucket per instance. |
| 11 | Protected routes re-read the account from the database | An admin who deactivates a staff member expects it to take effect now, not at token expiry. |
| 12 | Session tokens in a module separate from password hashing | The middleware runs on the Edge and may only use Web Crypto. Sharing a module with bcrypt dragged Node crypto into every request. |
| 13 | Arabic is the default locale | Egyptian office, Gulf customers. English is a full alternative, not a fallback. |
| 14 | Testimonials shown in Arabic in both locales | They are three real customers' words. Rewording them in English would put sentences in their mouths. |

## Assumptions still standing

| Assumption | Where it lives | Cost to change |
|---|---|---|
| Two roles, admin and staff | `user_role` enum | Low for another role, higher for per-resource permissions. |
| Nobody is alerted when a request arrives | — | Requests wait in the dashboard until someone looks. An email or WhatsApp alert is additive; the inquiry service already has the hook point at creation. |
| Sessions last 12 hours | `SESSION_TTL_SECONDS` in `src/lib/session-token.ts` | Trivial. |
| 8 requests per IP per hour | `RATE_LIMIT` in the inquiries route | Trivial. |
| Images are hotlinked from Pexels | `db/catalogue.ts` | Low, but worth doing before go-live: the site currently depends on a third-party host staying available. |

## Imported from the existing site (September 2026)

Source: `cairo-people-vip-lux-p63m.bolt.host`, a single Arabic page. Every
other route on it returns 404, and its "EN" switch is not wired to anything.

Imported: the three Fast Track tiers with their four advertised inclusions
each; the twelve car models in their five categories; the 12-hour all-inclusive
package terms (fuel, driver, parking); the three hotel partners; the Zamalek
and New Cairo apartments with their two-to-four-bedroom, penthouse, security
and daily-cleaning detail; a fourth stay type the specification had missed
entirely, Executive VIP Studios; the hero and about copy; the trust statistics;
three customer testimonials; and the stock photography.

**Not present on that site, and therefore not imported:**

| Missing | What the site actually says |
|---|---|
| Every price | Nothing. Not one figure, for any of the four services. The only numbers on the whole page are `12` (hours per day), `15`, `5000`, `24/7`, `50`, `100`, `2`–`4` (bedrooms), `5` (stars), `7` (BMW 7 Series) and the phone number. |
| Per-model car counts | Only "+50 سيارة فاخرة" as a fleet-wide marketing figure. It does not say how many Maybachs, or whether the 50 includes partner vehicles. |
| Apartment and room counts | Nothing. Only that apartments run from two to four bedrooms. |
| Fast Track daily capacity | Nothing. |

So prices stay at zero and units stay as `PLACEHOLDER-n`. Two tests in
`tests/catalogue.test.ts` fail if a price field or a real-looking inventory
count is ever added to the seed.

Two judgement calls worth flagging:

- **Testimonials are shown in Arabic in both locales.** They are three real
  customers' words. Rewording them in English would put sentences in their
  mouths that they did not say. Names and cities are transliterated.
- **"+50 luxury cars" is displayed as-is.** It is the office's own existing
  claim on its own live site, so reusing it is not a new assertion. If the
  real fleet is smaller, or the figure counts partner vehicles, that claim
  needs reviewing before go-live — but that is the office's call, not a
  technical one.

## Still needs confirmation

Content and go-live blockers, not architecture blockers.

1. Real prices for every service. Confirmed absent from the existing site, so
   there is no source for them other than the office.
2. Real unit counts: how many of each car, how many rooms per hotel, how many
   apartments per area, how many Fast Track representatives per day. Also
   confirmed absent.
2b. Whether the "+50 luxury cars" figure on the current site is accurate and
   whether it counts partner vehicles.
3. Hosting and domain target.
4. Cancellation and modification policy for a confirmed booking. The system
   currently allows staff to cancel at any point before completion, with no fee
   logic, because no policy has been given.
5. Whether prices should ever be shown in a currency other than EGP.
