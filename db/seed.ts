/**
 * Seeds the service catalogue and inventory from db/catalogue.ts.
 *
 * Re-running is safe and is how copy updates are applied:
 *   - A missing service is inserted.
 *   - An existing service has its names, descriptions, highlights, image and
 *     category refreshed from the catalogue.
 *   - `base_price_minor` and `active` are NEVER touched after the first insert.
 *     Prices are set by an admin in the dashboard and this script must not
 *     overwrite that work.
 *   - Units are only ever added up to the placeholder count, never renamed or
 *     removed, so real plates and room numbers entered by staff survive.
 */
import 'dotenv/config';
import { createDb, toJsonb } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';
import { CATALOGUE } from './catalogue';

async function main() {
  const db = createDb();
  let added = 0;
  let refreshed = 0;
  let unitsAdded = 0;

  try {
    for (const s of CATALOGUE) {
      const existing = await db
        .selectFrom('services')
        .select(['id'])
        .where('slug', '=', s.slug)
        .executeTakeFirst();

      let serviceId: string;

      if (existing) {
        await db
          .updateTable('services')
          .set({
            category_en: s.categoryEn,
            category_ar: s.categoryAr,
            name_en: s.nameEn,
            name_ar: s.nameAr,
            description_en: s.descriptionEn,
            description_ar: s.descriptionAr,
            highlights: toJsonb(s.highlights) as never,
            image_url: s.imageUrl ?? null,
            sort_order: s.sortOrder,
            // base_price_minor and active are deliberately absent.
          })
          .where('id', '=', existing.id)
          .execute();
        serviceId = existing.id;
        refreshed += 1;
      } else {
        const inserted = await db
          .insertInto('services')
          .values({
            type: s.type,
            slug: s.slug,
            category_en: s.categoryEn,
            category_ar: s.categoryAr,
            name_en: s.nameEn,
            name_ar: s.nameAr,
            description_en: s.descriptionEn,
            description_ar: s.descriptionAr,
            highlights: toJsonb(s.highlights) as never,
            image_url: s.imageUrl ?? null,
            base_price_minor: 0, // NOT a real price. Set it in the dashboard.
            sort_order: s.sortOrder,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        serviceId = inserted.id;
        added += 1;
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

    const anyUser = await db.selectFrom('users').select('id').executeTakeFirst();
    if (!anyUser) {
      const email = process.env.SEED_ADMIN_EMAIL;
      const password = process.env.SEED_ADMIN_PASSWORD;
      if (!email || !password) {
        console.warn('\n  No admin created: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.');
      } else if (password.length < 12) {
        console.warn('\n  No admin created: SEED_ADMIN_PASSWORD must be at least 12 characters.');
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

    const unpriced = await db
      .selectFrom('services')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('base_price_minor', '=', 0)
      .executeTakeFirstOrThrow();

    const placeholders = await db
      .selectFrom('units')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('identifier', 'like', 'PLACEHOLDER-%')
      .executeTakeFirstOrThrow();

    console.log(
      `\n  Services added: ${added}   refreshed: ${refreshed}   placeholder units added: ${unitsAdded}`,
    );
    console.log('\n  STILL REQUIRED BEFORE GO-LIVE');
    console.log(`    ${Number(unpriced.count)} services have no price. The office site lists none,`);
    console.log('      so none could be imported. Set them in Dashboard → Inventory.');
    console.log(`    ${Number(placeholders.count)} units are placeholders. Real plate numbers, room`);
    console.log('      numbers and daily Fast Track rep capacity are not published anywhere.\n');
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
