import type { Queryable } from './db';
import type { ServiceType } from './schema';

const PUBLIC_COLUMNS = [
  'services.id',
  'services.type',
  'services.slug',
  'services.category_en',
  'services.category_ar',
  'services.name_ar',
  'services.name_en',
  'services.description_ar',
  'services.description_en',
  'services.highlights',
  'services.image_url',
  'services.sort_order',
] as const;

/** Public catalogue: active services only, in display order. */
export async function listPublicServices(db: Queryable, type?: ServiceType) {
  let q = db
    .selectFrom('services')
    .where('services.active', '=', true)
    .select(PUBLIC_COLUMNS)
    .orderBy('services.sort_order', 'asc')
    .orderBy('services.name_en', 'asc');

  if (type) q = q.where('services.type', '=', type);
  return q.execute();
}

export async function getServiceBySlug(db: Queryable, slug: string) {
  return db
    .selectFrom('services')
    .selectAll()
    .where('slug', '=', slug)
    .where('active', '=', true)
    .executeTakeFirst();
}

/** Admin catalogue: everything, including inactive services. */
export async function listAllServices(db: Queryable) {
  return db
    .selectFrom('services')
    .selectAll()
    .orderBy('type', 'asc')
    .orderBy('sort_order', 'asc')
    .execute();
}
