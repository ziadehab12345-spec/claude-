-- Ahl Cairo Booking Platform — initial schema
--
-- Business-critical invariant: a unit can never hold two overlapping ACTIVE bookings.
-- Enforced by a Postgres EXCLUDE constraint (bookings_no_overlap), not by
-- application code alone. The application check exists to produce a friendly
-- error; the database is the source of truth.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- allows `unit_id WITH =` inside a GiST exclusion

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_role      AS ENUM ('admin', 'staff');
CREATE TYPE service_type   AS ENUM ('car', 'hotel', 'apartment', 'fasttrack');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE booking_source AS ENUM ('online', 'staff_manual');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- ---------------------------------------------------------------------------
-- Users (staff + admin only; customers have no accounts in v1)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  role          user_role   NOT NULL,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Emails are compared case-insensitively.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- ---------------------------------------------------------------------------
-- Services — a bookable product line (a car category, a hotel, an apartment,
-- a Fast Track package). Prices live here, never in code.
-- ---------------------------------------------------------------------------
CREATE TABLE services (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  type           service_type NOT NULL,
  slug           text         NOT NULL UNIQUE,
  category       text         NOT NULL,
  name_ar        text         NOT NULL,
  name_en        text         NOT NULL,
  description_ar text         NOT NULL DEFAULT '',
  description_en text         NOT NULL DEFAULT '',
  -- Price for one billing period (one day for cars, one night for stays,
  -- one service for Fast Track). Minor units (piastres) to avoid float error.
  base_price_minor bigint     NOT NULL CHECK (base_price_minor >= 0),
  currency       char(3)      NOT NULL DEFAULT 'EGP',
  image_url      text,
  sort_order     integer      NOT NULL DEFAULT 0,
  active         boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX services_type_active_idx ON services (type, active);

-- ---------------------------------------------------------------------------
-- Units — the individually bookable thing inside a service.
--   car        -> one physical vehicle (identifier = plate)
--   hotel      -> one room / room-allotment slot
--   apartment  -> one apartment
--   fasttrack  -> one representative slot for a day (capacity N = N unit rows)
--
-- Modelling Fast Track capacity as N unit rows is deliberate: it lets every
-- service type share ONE availability engine and ONE database constraint.
-- ---------------------------------------------------------------------------
CREATE TABLE units (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid        NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  identifier text        NOT NULL,
  label_ar   text        NOT NULL DEFAULT '',
  label_en   text        NOT NULL DEFAULT '',
  attributes jsonb       NOT NULL DEFAULT '{}'::jsonb,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, identifier)
);

CREATE INDEX units_service_active_idx ON units (service_id, active);

-- ---------------------------------------------------------------------------
-- Bookings
--
-- DATE SEMANTICS (applies to every service type, no exceptions):
--   start_date is INCLUSIVE, end_date is EXCLUSIVE  ->  [start_date, end_date)
--   Hotel/apartment: start = check-in, end = check-out. The check-out day is
--     free for the next guest.
--   Car: start = pickup day, end = return day. A one-day rental is
--     end = start + 1.
--   Fast Track: end is always start + 1 (the service occupies that one day).
--
-- `occupancy` is generated from those two columns so the exclusion constraint
-- can never drift from the data the application reads.
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text           NOT NULL UNIQUE,
  unit_id        uuid           NOT NULL REFERENCES units (id) ON DELETE RESTRICT,
  service_id     uuid           NOT NULL REFERENCES services (id) ON DELETE RESTRICT,

  customer_name  text           NOT NULL,
  customer_phone text           NOT NULL,
  customer_email text,

  start_date     date           NOT NULL,
  end_date       date           NOT NULL,
  occupancy      daterange      GENERATED ALWAYS AS (daterange(start_date, end_date, '[)')) STORED,

  -- Fast Track only: the flight time on start_date. Informational for staff,
  -- it does not participate in the overlap check (a rep is booked for the day).
  flight_time    time,
  flight_number  text,

  status         booking_status NOT NULL DEFAULT 'pending',
  source         booking_source NOT NULL,

  price_minor    bigint         NOT NULL CHECK (price_minor >= 0),
  currency       char(3)        NOT NULL DEFAULT 'EGP',
  price_overridden boolean      NOT NULL DEFAULT false,

  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  payment_notes  text           NOT NULL DEFAULT '',
  notes          text           NOT NULL DEFAULT '',

  created_by_staff_id uuid      REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT bookings_dates_ordered CHECK (end_date > start_date),
  -- A booking taken through the dashboard must record who took it.
  CONSTRAINT bookings_manual_has_staff
    CHECK (source <> 'staff_manual' OR created_by_staff_id IS NOT NULL)
);

-- THE constraint. Two bookings on the same unit may not have overlapping
-- occupancy while both are 'pending' or 'confirmed'. Cancelled and completed
-- bookings are excluded so a cancelled range is immediately re-bookable.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    unit_id   WITH =,
    occupancy WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));

CREATE INDEX bookings_status_idx        ON bookings (status);
CREATE INDEX bookings_service_date_idx  ON bookings (service_id, start_date);
CREATE INDEX bookings_unit_date_idx     ON bookings (unit_id, start_date);
CREATE INDEX bookings_customer_phone_idx ON bookings (customer_phone);

-- ---------------------------------------------------------------------------
-- Unit blocks — staff take a unit out of service (maintenance, owner use,
-- allotment released back to the hotel). Same half-open date semantics.
-- Blocks also participate in the availability engine.
-- ---------------------------------------------------------------------------
CREATE TABLE unit_blocks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id    uuid        NOT NULL REFERENCES units (id) ON DELETE CASCADE,
  start_date date        NOT NULL,
  end_date   date        NOT NULL,
  occupancy  daterange   GENERATED ALWAYS AS (daterange(start_date, end_date, '[)')) STORED,
  reason     text        NOT NULL DEFAULT '',
  created_by_staff_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unit_blocks_dates_ordered CHECK (end_date > start_date)
);

ALTER TABLE unit_blocks
  ADD CONSTRAINT unit_blocks_no_overlap
  EXCLUDE USING gist (unit_id WITH =, occupancy WITH &&);

CREATE INDEX unit_blocks_unit_date_idx ON unit_blocks (unit_id, start_date);

-- ---------------------------------------------------------------------------
-- Audit log — every status change and price override, who and when.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id            bigserial   PRIMARY KEY,
  actor_user_id uuid        REFERENCES users (id) ON DELETE SET NULL,
  actor_label   text        NOT NULL DEFAULT 'system',
  action        text        NOT NULL,
  entity        text        NOT NULL,
  entity_id     text        NOT NULL,
  details       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx     ON audit_logs (entity, entity_id, created_at DESC);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Rate limiting — DB-backed so it works across serverless instances.
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limits (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX rate_limits_window_idx ON rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- Booking reference numbers: AC-<year><6 digits>, e.g. AC-26000042
-- ---------------------------------------------------------------------------
CREATE SEQUENCE booking_reference_seq START 1;

-- ---------------------------------------------------------------------------
-- updated_at is maintained by the database, so no caller can forget it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER units_set_updated_at    BEFORE UPDATE ON units    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
