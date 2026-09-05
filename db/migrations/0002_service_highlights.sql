-- Service highlights: the bullet list of what a package includes.
--
-- The Fast Track tiers, the car packages and the stay types each advertise a
-- short list of inclusions. These are business copy that the office will edit,
-- so they live in the database with the rest of the catalogue rather than in
-- the code.
--
-- Shape: [{ "ar": "...", "en": "..." }, …]

ALTER TABLE services
  ADD COLUMN highlights jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE services
  ADD CONSTRAINT services_highlights_is_array
  CHECK (jsonb_typeof(highlights) = 'array');
