/**
 * Seeds the service catalogue from db/catalogue.ts.
 *
 * The catalogue is the office's own copy, taken from its existing site. There
 * are no prices and no inventory here: this site shows what the office offers
 * and passes the request to the office, which quotes and confirms by hand.
 *
 * Re-running is safe and is how copy updates are applied. `active` is never
 * touched after the first insert, so a service hidden in the dashboard stays
 * hidden.
 */
import 'dotenv/config';
import { createDb, toJsonb } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';
import { CATALOGUE } from './catalogue';

async function main() {
  const db = createDb();
  let added = 0;
  let refreshed = 0;

  try {
    for (const s of CATALOGUE) {
      const existing = await db
        .selectFrom('services')
        .select(['id'])
        .where('slug', '=', s.slug)
        .executeTakeFirst();

      const content = {
        category_en: s.categoryEn,
        category_ar: s.categoryAr,
        name_en: s.nameEn,
        name_ar: s.nameAr,
        description_en: s.descriptionEn,
        description_ar: s.descriptionAr,
        highlights: toJsonb(s.highlights) as never,
        image_url: s.imageUrl ?? null,
        sort_order: s.sortOrder,
      };

      if (existing) {
        // `active` is deliberately absent — it belongs to the dashboard.
        await db.updateTable('services').set(content).where('id', '=', existing.id).execute();
        refreshed += 1;
      } else {
        await db
          .insertInto('services')
          .values({ type: s.type, slug: s.slug, ...content })
          .execute();
        added += 1;
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

    console.log(`\n  Services added: ${added}   refreshed: ${refreshed}\n`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
