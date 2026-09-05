/**
 * Seeds the service catalogue and inventory.
 *
 * WHAT IS REAL AND WHAT IS NOT
 * ----------------------------
 * The service list below (car models and their categories, hotel partners,
 * apartment areas, Fast Track tiers) comes from the confirmed catalogue in
 * docs/SPEC.md.
 *
 * Two things are NOT confirmed and are therefore NOT invented here:
 *
 *   1. PRICES. Every base price is seeded as 0. Nothing in this repository
 *      knows what Ahl Cairo charges. An admin sets real prices in the
 *      dashboard before go-live. A zero price is deliberately visible and
 *      wrong so it cannot be shipped by accident.
 *
 *   2. UNIT COUNTS. Real plate numbers, room numbers and daily rep capacity are
 *      unknown, so each service gets placeholder units named PLACEHOLDER-n.
 *      An admin replaces these with the real inventory before go-live.
 *
 * Re-running this script is safe: it inserts what is missing and leaves
 * existing rows, including any prices already set, untouched.
 */
import 'dotenv/config';
import { createDb } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';
import type { ServiceType } from '../src/lib/schema';

interface SeedService {
  type: ServiceType;
  slug: string;
  category: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** Placeholder inventory size. Replace with real counts before go-live. */
  placeholderUnits: number;
  sortOrder: number;
  attributes?: Record<string, unknown>;
}

const CARS: SeedService[] = [
  { type: 'car', slug: 'mercedes-maybach', category: 'VIP Sedan', nameEn: 'Mercedes-Maybach', nameAr: 'مرسيدس مايباخ', descriptionEn: 'Flagship chauffeured sedan with a bilingual driver.', descriptionAr: 'سيارة الصدارة مع سائق يتحدث العربية والإنجليزية.', placeholderUnits: 1, sortOrder: 10 },
  { type: 'car', slug: 'mercedes-s-class', category: 'VIP Sedan', nameEn: 'Mercedes S-Class', nameAr: 'مرسيدس اس كلاس', descriptionEn: 'Chauffeured luxury sedan.', descriptionAr: 'سيارة فاخرة مع سائق.', placeholderUnits: 1, sortOrder: 11 },
  { type: 'car', slug: 'bmw-7-series', category: 'VIP Sedan', nameEn: 'BMW 7 Series', nameAr: 'بي إم دبليو الفئة السابعة', descriptionEn: 'Chauffeured luxury sedan.', descriptionAr: 'سيارة فاخرة مع سائق.', placeholderUnits: 1, sortOrder: 12 },
  { type: 'car', slug: 'mercedes-e-class', category: 'Executive', nameEn: 'Mercedes E-Class', nameAr: 'مرسيدس إي كلاس', descriptionEn: 'Executive sedan with a bilingual driver.', descriptionAr: 'سيارة رجال أعمال مع سائق.', placeholderUnits: 1, sortOrder: 20 },
  { type: 'car', slug: 'audi-a6', category: 'Executive', nameEn: 'Audi A6', nameAr: 'أودي A6', descriptionEn: 'Executive sedan with a bilingual driver.', descriptionAr: 'سيارة رجال أعمال مع سائق.', placeholderUnits: 1, sortOrder: 21 },
  { type: 'car', slug: 'mercedes-v-class', category: 'Family / Minivan', nameEn: 'Mercedes V-Class', nameAr: 'مرسيدس في كلاس', descriptionEn: 'Family minivan with a bilingual driver.', descriptionAr: 'ميني فان عائلية مع سائق.', placeholderUnits: 1, sortOrder: 30 },
  { type: 'car', slug: 'toyota-hiace-vip', category: 'Family / Minivan', nameEn: 'Toyota HiAce VIP', nameAr: 'تويوتا هايس VIP', descriptionEn: 'Large family van with a bilingual driver.', descriptionAr: 'فان عائلي كبير مع سائق.', placeholderUnits: 1, sortOrder: 31 },
  { type: 'car', slug: 'hyundai-h1-vip', category: 'Family / Minivan', nameEn: 'Hyundai H1 VIP', nameAr: 'هيونداي H1 VIP', descriptionEn: 'Family van with a bilingual driver.', descriptionAr: 'فان عائلي مع سائق.', placeholderUnits: 1, sortOrder: 32 },
  { type: 'car', slug: 'range-rover', category: '4x4 Luxury', nameEn: 'Range Rover', nameAr: 'رينج روفر', descriptionEn: 'Luxury 4x4 with a bilingual driver.', descriptionAr: 'دفع رباعي فاخر مع سائق.', placeholderUnits: 1, sortOrder: 40 },
  { type: 'car', slug: 'cadillac-escalade', category: '4x4 Luxury', nameEn: 'Cadillac Escalade', nameAr: 'كاديلاك إسكاليد', descriptionEn: 'Luxury 4x4 with a bilingual driver.', descriptionAr: 'دفع رباعي فاخر مع سائق.', placeholderUnits: 1, sortOrder: 41 },
  { type: 'car', slug: 'toyota-camry', category: 'Economy Sedan', nameEn: 'Toyota Camry', nameAr: 'تويوتا كامري', descriptionEn: 'Comfortable sedan with a bilingual driver.', descriptionAr: 'سيارة مريحة مع سائق.', placeholderUnits: 1, sortOrder: 50 },
  { type: 'car', slug: 'hyundai-sonata', category: 'Economy Sedan', nameEn: 'Hyundai Sonata', nameAr: 'هيونداي سوناتا', descriptionEn: 'Comfortable sedan with a bilingual driver.', descriptionAr: 'سيارة مريحة مع سائق.', placeholderUnits: 1, sortOrder: 51 },
];

const HOTELS: SeedService[] = [
  { type: 'hotel', slug: 'four-seasons', category: '5-Star Hotel', nameEn: 'Four Seasons', nameAr: 'فورسيزونز', descriptionEn: 'Partner five-star hotel.', descriptionAr: 'فندق شريك خمس نجوم.', placeholderUnits: 1, sortOrder: 10 },
  { type: 'hotel', slug: 'fairmont', category: '5-Star Hotel', nameEn: 'Fairmont', nameAr: 'فيرمونت', descriptionEn: 'Partner five-star hotel.', descriptionAr: 'فندق شريك خمس نجوم.', placeholderUnits: 1, sortOrder: 11 },
  { type: 'hotel', slug: 'marriott-nile-city', category: '5-Star Hotel', nameEn: 'Marriott Nile City', nameAr: 'ماريوت نايل سيتي', descriptionEn: 'Partner five-star hotel.', descriptionAr: 'فندق شريك خمس نجوم.', placeholderUnits: 1, sortOrder: 12 },
];

const APARTMENTS: SeedService[] = [
  { type: 'apartment', slug: 'zamalek-serviced-apartment', category: 'Serviced Apartment', nameEn: 'Zamalek Serviced Apartment', nameAr: 'شقة فندقية بالزمالك', descriptionEn: 'Serviced apartment in Zamalek.', descriptionAr: 'شقة فندقية في الزمالك.', placeholderUnits: 1, sortOrder: 10 },
  { type: 'apartment', slug: 'new-cairo-serviced-apartment', category: 'Serviced Apartment', nameEn: 'New Cairo Serviced Apartment', nameAr: 'شقة فندقية بالتجمع الخامس', descriptionEn: 'Serviced apartment in New Cairo (Tagamoa).', descriptionAr: 'شقة فندقية في التجمع الخامس.', placeholderUnits: 1, sortOrder: 11 },
];

const FASTTRACK: SeedService[] = [
  { type: 'fasttrack', slug: 'fast-track-classic', category: 'Fast Track', nameEn: 'Fast Track — Classic', nameAr: 'فاست تراك — كلاسيك', descriptionEn: 'Airport meet-and-greet and expedited passport processing.', descriptionAr: 'استقبال بالمطار وإنهاء إجراءات الجوازات.', placeholderUnits: 5, sortOrder: 10 },
  { type: 'fasttrack', slug: 'fast-track-golf-cart', category: 'Fast Track', nameEn: 'Fast Track — Golf Cart', nameAr: 'فاست تراك — عربة جولف', descriptionEn: 'Classic service plus a golf cart through the terminal.', descriptionAr: 'خدمة الكلاسيك مع عربة جولف داخل المطار.', placeholderUnits: 5, sortOrder: 20 },
  { type: 'fasttrack', slug: 'fast-track-vip-personal', category: 'Fast Track', nameEn: 'Fast Track — VIP Personal', nameAr: 'فاست تراك — VIP شخصي', descriptionEn: 'Dedicated personal representative from aircraft door to car.', descriptionAr: 'مندوب شخصي من باب الطائرة حتى السيارة.', placeholderUnits: 5, sortOrder: 30 },
];

const ALL = [...FASTTRACK, ...CARS, ...HOTELS, ...APARTMENTS];

async function main() {
  const db = createDb();
  let servicesAdded = 0;
  let unitsAdded = 0;

  try {
    for (const s of ALL) {
      const existing = await db
        .selectFrom('services')
        .select(['id'])
        .where('slug', '=', s.slug)
        .executeTakeFirst();

      let serviceId: string;
      if (existing) {
        serviceId = existing.id;
      } else {
        const inserted = await db
          .insertInto('services')
          .values({
            type: s.type,
            slug: s.slug,
            category: s.category,
            name_en: s.nameEn,
            name_ar: s.nameAr,
            description_en: s.descriptionEn,
            description_ar: s.descriptionAr,
            base_price_minor: 0, // NOT a real price. Set it in the dashboard.
            sort_order: s.sortOrder,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        serviceId = inserted.id;
        servicesAdded += 1;
      }

      const { count } = await db
        .selectFrom('units')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('service_id', '=', serviceId)
        .executeTakeFirstOrThrow();

      for (let i = Number(count) + 1; i <= s.placeholderUnits; i += 1) {
        await db
          .insertInto('units')
          .values({
            service_id: serviceId,
            identifier: `PLACEHOLDER-${i}`,
            label_en: `${s.nameEn} #${i}`,
            label_ar: `${s.nameAr} #${i}`,
            attributes: { placeholder: true } as never,
          })
          .execute();
        unitsAdded += 1;
      }
    }

    // Initial administrator, only if there is no account at all yet.
    const anyUser = await db.selectFrom('users').select('id').executeTakeFirst();
    if (!anyUser) {
      const email = process.env.SEED_ADMIN_EMAIL;
      const password = process.env.SEED_ADMIN_PASSWORD;
      if (!email || !password) {
        console.warn(
          '\n  No admin account created: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env and re-run.',
        );
      } else if (password.length < 12) {
        console.warn('\n  No admin account created: SEED_ADMIN_PASSWORD must be at least 12 characters.');
      } else {
        await db
          .insertInto('users')
          .values({
            name: 'Administrator',
            email: email.trim().toLowerCase(),
            password_hash: await hashPassword(password),
            role: 'admin',
          })
          .execute();
        console.log(`  Created admin account: ${email}`);
      }
    }

    console.log(`\n  Services added: ${servicesAdded}   Placeholder units added: ${unitsAdded}`);
    console.log('\n  BEFORE GO-LIVE, in the dashboard:');
    console.log('    1. Set a real base price for every service (all are seeded at 0).');
    console.log('    2. Replace every PLACEHOLDER-n unit with the real plate / room / slot.');
    console.log('    3. Confirm daily Fast Track rep capacity (seeded as 5 slots per tier).\n');
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
