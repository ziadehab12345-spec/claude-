-- Repoint the product: service showcase + contact, not a booking engine.
--
-- The office confirms everything by phone and WhatsApp and does not want to
-- publish prices or maintain per-unit inventory. The availability engine, the
-- unit inventory and the whole overlap-checking machinery therefore have no
-- job to do here and are removed rather than left as dead weight.
--
-- What replaces them is one table: a record of every request that comes in, so
-- a lead that never reaches WhatsApp is not simply lost.
--
-- The removed booking system is preserved in git history (see the commit
-- "Add data model, availability engine and booking API") and can be restored
-- if the office later decides to hold and sell its own allotment.

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS unit_blocks;
DROP TABLE IF EXISTS units;

DROP TYPE IF EXISTS booking_status;
DROP TYPE IF EXISTS booking_source;
DROP TYPE IF EXISTS payment_status;

DROP SEQUENCE IF EXISTS booking_reference_seq;

-- Prices are not published and not held anywhere in this system.
ALTER TABLE services DROP COLUMN IF EXISTS base_price_minor;
ALTER TABLE services DROP COLUMN IF EXISTS currency;

-- ---------------------------------------------------------------------------
-- Inquiries — one row per request from the public site.
-- ---------------------------------------------------------------------------
CREATE TYPE inquiry_status AS ENUM ('new', 'contacted', 'confirmed', 'closed');
CREATE TYPE inquiry_source AS ENUM ('website', 'whatsapp', 'phone', 'staff_manual');

CREATE TABLE inquiries (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text           NOT NULL UNIQUE,

  -- Which service was being asked about. Null for a general enquiry sent from
  -- the contact page, and kept if the service is later removed.
  service_id     uuid           REFERENCES services (id) ON DELETE SET NULL,
  -- The service name as it stood when the request came in, so the record still
  -- reads correctly after the catalogue changes.
  service_label  text           NOT NULL DEFAULT '',

  customer_name  text           NOT NULL,
  customer_phone text           NOT NULL,
  customer_email text,
  -- Where the guest is travelling from. Useful to the office, never required.
  country        text,

  -- Travel dates the guest would like. Both optional: this is a request, not a
  -- reservation, and nothing is checked against a calendar.
  preferred_start date,
  preferred_end   date,
  party_size      integer        CHECK (party_size IS NULL OR party_size BETWEEN 1 AND 50),
  flight_number   text,

  message        text           NOT NULL DEFAULT '',
  status         inquiry_status NOT NULL DEFAULT 'new',
  source         inquiry_source NOT NULL DEFAULT 'website',
  staff_notes    text           NOT NULL DEFAULT '',

  handled_by_staff_id uuid      REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT inquiries_dates_ordered
    CHECK (preferred_end IS NULL OR preferred_start IS NULL OR preferred_end >= preferred_start)
);

CREATE INDEX inquiries_status_created_idx ON inquiries (status, created_at DESC);
CREATE INDEX inquiries_created_idx        ON inquiries (created_at DESC);
CREATE INDEX inquiries_service_idx        ON inquiries (service_id);
CREATE INDEX inquiries_phone_idx          ON inquiries (customer_phone);

CREATE TRIGGER inquiries_set_updated_at
  BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE SEQUENCE inquiry_reference_seq START 1;
