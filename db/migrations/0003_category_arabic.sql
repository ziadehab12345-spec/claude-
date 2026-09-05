-- Category names need Arabic too.
--
-- `category` groups services on the public pages ("VIP Luxury Sedan",
-- "5-Star Hotel"). It was English-only, so an Arabic visitor saw English
-- group headings on an otherwise fully Arabic page.

ALTER TABLE services RENAME COLUMN category TO category_en;
ALTER TABLE services ADD COLUMN category_ar text NOT NULL DEFAULT '';

-- Existing rows fall back to the English name until the seed refreshes them.
UPDATE services SET category_ar = category_en WHERE category_ar = '';
