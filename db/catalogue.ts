/**
 * The service catalogue, imported from the office's existing site
 * (cairo-people-vip-lux-p63m.bolt.host).
 *
 * The Arabic copy is that site's own wording, kept verbatim so the new site
 * says exactly what the office already says. The English is a translation of
 * it — no English marketing claim here was invented.
 *
 * This site shows what the office offers and hands the request to the office.
 * It quotes no prices and holds no inventory, which matches both how the
 * business actually runs and what that site publishes: no price appears
 * anywhere on it, and the only inventory figure is a fleet-wide "+50 luxury
 * cars" marketing claim.

 *
 * Images are the Pexels stock photos the office already uses on that site.
 * They are stock, not photographs of the actual cars and apartments.
 */
import type { ServiceType } from '../src/lib/schema';

export interface SeedService {
  type: ServiceType;
  slug: string;
  categoryEn: string;
  categoryAr: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  highlights: { ar: string; en: string }[];
  imageUrl?: string;
  sortOrder: number;
}

/**
 * Card images are displayed around 400px wide, so 800 is enough for a 2x
 * screen. Requesting 1200 would have shipped roughly twice the bytes for no
 * visible difference across a page of twelve cards.
 */
const IMG = (id: string) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop`;

// ---------------------------------------------------------------------------
// Airport Fast Track — three tiers, inclusions taken from the existing site
// ---------------------------------------------------------------------------
export const FASTTRACK: SeedService[] = [
  {
    type: 'fasttrack',
    slug: 'fast-track-classic',
    categoryEn: 'Fast Track', categoryAr: 'الاستقبال السريع بالمطار',
    nameAr: 'الخدمة الكلاسيكية',
    nameEn: 'Classic Service',
    descriptionAr:
      'استقبال مندوبنا داخل صالة الوصول قبل جوازات السفر حاملاً لوحة باسمكم وشعار أهل كايرو. إنهاء جميع الإجراءات (جوازات، شراء التأشيرة، استلام الأمتعة) + بورتر مخصص للأمتعة.',
    descriptionEn:
      'Our representative meets you inside the arrivals hall before passport control, holding a board with your name and the Ahl Cairo logo. All formalities handled — passports, visa purchase, baggage collection — plus a dedicated luggage porter.',
    highlights: [
      { ar: 'استقبال قبل جوازات السفر', en: 'Met before passport control' },
      { ar: 'لوحة باسم الضيف وشعار أهل كايرو', en: 'Name board with the Ahl Cairo logo' },
      { ar: 'إنهاء جميع الإجراءات', en: 'All airport formalities handled' },
      { ar: 'بورتر أمتعة مخصص', en: 'Dedicated luggage porter' },
    ],
    imageUrl: IMG('17233279'),
    sortOrder: 10,
  },
  {
    type: 'fasttrack',
    slug: 'fast-track-golf-cart',
    categoryEn: 'Fast Track', categoryAr: 'الاستقبال السريع بالمطار',
    nameAr: 'خدمة الجولف كار',
    nameEn: 'Golf Cart Service',
    descriptionAr:
      'تشمل جميع مميزات الخدمة الكلاسيكية بالإضافة إلى نقل خاص بسيارة جولف فاخرة عبر بوابات المطار لتوفير عناء المشي.',
    descriptionEn:
      'Everything in the Classic Service, plus private transfer by luxury golf cart through the airport gates so there is no walking.',
    highlights: [
      { ar: 'جميع مميزات الخدمة الكلاسيكية', en: 'Everything in the Classic Service' },
      { ar: 'جولف كار فاخرة خاصة', en: 'Private luxury golf cart' },
      { ar: 'نقل عبر بوابات المطار', en: 'Transfer through the airport gates' },
      { ar: 'توفير عناء المشي', en: 'No walking through the terminal' },
    ],
    imageUrl: IMG('16954180'),
    sortOrder: 20,
  },
  {
    type: 'fasttrack',
    slug: 'fast-track-vip-personal',
    categoryEn: 'Fast Track', categoryAr: 'الاستقبال السريع بالمطار',
    nameAr: 'الخدمة الشخصية VIP',
    nameEn: 'VIP Personal Service',
    descriptionAr:
      'سيارة خاصة بانتظاركم مباشرة على مدرج الطائرة، نقل فوري إلى صالة VIP، إنهاء كافة الإجراءات ومعالجة الأمتعة بينما تستريحون في الصالة.',
    descriptionEn:
      'A private car waits for you at the aircraft steps, taking you straight to the VIP lounge. All formalities and baggage are handled while you rest.',
    highlights: [
      { ar: 'سيارة على مدرج الطائرة', en: 'Car at the aircraft steps' },
      { ar: 'نقل فوري لصالة VIP', en: 'Straight to the VIP lounge' },
      { ar: 'إنهاء الإجراءات أثناء الراحة', en: 'Formalities handled while you rest' },
      { ar: 'معالجة الأمتعة بالكامل', en: 'Baggage handled end to end' },
    ],
    imageUrl: IMG('18029642'),
    sortOrder: 30,
  },
];

// ---------------------------------------------------------------------------
// Chauffeured fleet — twelve models in the five categories the site uses.
// Every package is 12 hours a day, all-inclusive, with a bilingual driver.
// ---------------------------------------------------------------------------
const CAR_HIGHLIGHTS = [
  { ar: '12 ساعة يومياً مع سائق مخصص', en: '12 hours a day with a dedicated driver' },
  {
    ar: 'شامل لكل شيء (وقود، راتب السائق، رسوم الانتظار في كل مكان)',
    en: 'All-inclusive: fuel, driver, and parking fees everywhere',
  },
  { ar: 'سائق مرشد محترف ثنائي اللغة', en: 'Professional bilingual driver and guide' },
  { ar: 'زجاج مخصوص للخصوصية العائلية', en: 'Privacy glass for family discretion' },
];

const car = (
  slug: string,
  nameAr: string,
  nameEn: string,
  categoryAr: string,
  categoryEn: string,
  sortOrder: number,
  imageId: string,
): SeedService => ({
  type: 'car',
  slug,
  categoryEn,
  categoryAr,
  nameAr,
  nameEn,
  descriptionAr: `${nameEn} ضمن فئة ${categoryAr}. باقة 12 ساعة يومياً مع سائق محترف ثنائي اللغة، شاملة الوقود ورسوم الانتظار.`,
  descriptionEn: `${nameEn}, part of our ${categoryEn} category. A 12-hour daily package with a professional bilingual driver, fuel and parking included.`,
  highlights: CAR_HIGHLIGHTS,
  imageUrl: IMG(imageId),
  sortOrder,
});

export const CARS: SeedService[] = [
  car('mercedes-maybach', 'مرسيدس مايباخ', 'Mercedes-Maybach', 'سيدان فائقة الفخامة VIP', 'VIP Luxury Sedan', 10, '10638649'),
  car('mercedes-s-class', 'مرسيدس اس كلاس', 'Mercedes S-Class', 'سيدان فائقة الفخامة VIP', 'VIP Luxury Sedan', 11, '11285174'),
  car('bmw-7-series', 'بي إم دبليو الفئة السابعة', 'BMW 7 Series', 'سيدان فائقة الفخامة VIP', 'VIP Luxury Sedan', 12, '14471686'),
  car('mercedes-e-class', 'مرسيدس إي كلاس', 'Mercedes E-Class', 'فئة تنفيذية وأعمال', 'Executive & Business', 20, '17264519'),
  car('audi-a6', 'أودي A6', 'Audi A6', 'فئة تنفيذية وأعمال', 'Executive & Business', 21, '1730814'),
  car('mercedes-v-class', 'مرسيدس في كلاس', 'Mercedes V-Class', 'عائلية VIP وميني باص', 'VIP Family & Minibus', 30, '17455632'),
  car('toyota-hiace-vip', 'تويوتا هايس VIP', 'Toyota HiAce VIP', 'عائلية VIP وميني باص', 'VIP Family & Minibus', 31, '18369294'),
  car('hyundai-h1-vip', 'هيونداي H1 VIP', 'Hyundai H1 VIP', 'عائلية VIP وميني باص', 'VIP Family & Minibus', 32, '19969216'),
  car('range-rover', 'رينج روفر', 'Range Rover', 'سيارات دفع رباعي فاخرة', 'Luxury 4x4', 40, '23319054'),
  car('cadillac-escalade', 'كاديلاك إسكاليد', 'Cadillac Escalade', 'سيارات دفع رباعي فاخرة', 'Luxury 4x4', 41, '32458233'),
  car('toyota-camry', 'تويوتا كامري', 'Toyota Camry', 'سيدان فاخرة صغيرة واقتصادية', 'Comfort Sedan', 50, '34094888'),
  car('hyundai-sonata', 'هيونداي سوناتا', 'Hyundai Sonata', 'سيدان فاخرة صغيرة واقتصادية', 'Comfort Sedan', 51, '36224723'),
];

// ---------------------------------------------------------------------------
// Hotels — the three partners named on the existing site.
// ---------------------------------------------------------------------------
const HOTEL_HIGHLIGHTS = [
  { ar: 'إطلالة مباشرة على نهر النيل', en: 'Direct Nile view' },
  { ar: 'أجنحة فندقية 5 نجوم', en: 'Five-star suites' },
  { ar: 'كونسيرج على مدار الساعة', en: '24/7 concierge' },
  { ar: 'خصوصية عائلية تامة', en: 'Complete family privacy' },
];

export const HOTELS: SeedService[] = [
  {
    type: 'hotel', slug: 'four-seasons', categoryEn: '5-Star Hotel', categoryAr: 'فنادق 5 نجوم',
    nameAr: 'فورسيزونز', nameEn: 'Four Seasons',
    descriptionAr: 'أفخم الأجنحة العالمية ذات الإطلالة المباشرة على نهر النيل.',
    descriptionEn: 'World-class suites with a direct view over the Nile.',
    highlights: HOTEL_HIGHLIGHTS, imageUrl: IMG('5996471'), sortOrder: 10,
  },
  {
    type: 'hotel', slug: 'fairmont', categoryEn: '5-Star Hotel', categoryAr: 'فنادق 5 نجوم',
    nameAr: 'فيرمونت', nameEn: 'Fairmont',
    descriptionAr: 'أفخم الأجنحة العالمية ذات الإطلالة المباشرة على نهر النيل.',
    descriptionEn: 'World-class suites with a direct view over the Nile.',
    highlights: HOTEL_HIGHLIGHTS, imageUrl: IMG('6436748'), sortOrder: 11,
  },
  {
    type: 'hotel', slug: 'marriott-nile-city', categoryEn: '5-Star Hotel', categoryAr: 'فنادق 5 نجوم',
    nameAr: 'ماريوت نايل سيتي', nameEn: 'Marriott Nile City',
    descriptionAr: 'أفخم الأجنحة العالمية ذات الإطلالة المباشرة على نهر النيل.',
    descriptionEn: 'World-class suites with a direct view over the Nile.',
    highlights: HOTEL_HIGHLIGHTS, imageUrl: IMG('6782581'), sortOrder: 12,
  },
];

// ---------------------------------------------------------------------------
// Apartments — the two areas named on the site, plus the executive studios it
// lists as a separate stay type.
// ---------------------------------------------------------------------------
const APARTMENT_HIGHLIGHTS = [
  { ar: 'شقق فسيحة من 2 إلى 4 غرف نوم', en: 'Spacious apartments, 2 to 4 bedrooms' },
  { ar: 'خدمات فندقية حصرية وتنظيف يومي', en: 'Hotel services with daily cleaning' },
  { ar: 'أمن على مدار الساعة', en: '24-hour security' },
  { ar: 'خصوصية عائلية تامة', en: 'Complete family privacy' },
];

export const APARTMENTS: SeedService[] = [
  {
    type: 'apartment', slug: 'zamalek-serviced-apartment', categoryEn: 'Serviced Apartment & Penthouse', categoryAr: 'شقق فندقية وبنتهاوس',
    nameAr: 'شقق وبنتهاوس الزمالك', nameEn: 'Zamalek Apartments & Penthouse',
    descriptionAr:
      'شقق فسيحة من 2 إلى 4 غرف نوم وخدمات فندقية حصرية وبنتهاوس في الطابق الأخير مع خصوصية عائلية تامة، أمن على مدار الساعة، وتنظيف يومي في الزمالك.',
    descriptionEn:
      'Spacious two to four bedroom apartments with exclusive hotel services, and a top-floor penthouse. Complete family privacy, 24-hour security and daily cleaning, in Zamalek.',
    highlights: APARTMENT_HIGHLIGHTS, imageUrl: IMG('7985342'), sortOrder: 10,
  },
  {
    type: 'apartment', slug: 'new-cairo-serviced-apartment', categoryEn: 'Serviced Apartment & Penthouse', categoryAr: 'شقق فندقية وبنتهاوس',
    nameAr: 'شقق وبنتهاوس التجمع الخامس', nameEn: 'New Cairo Apartments & Penthouse',
    descriptionAr:
      'شقق فسيحة من 2 إلى 4 غرف نوم وخدمات فندقية حصرية وبنتهاوس في الطابق الأخير مع خصوصية عائلية تامة، أمن على مدار الساعة، وتنظيف يومي في التجمع الخامس.',
    descriptionEn:
      'Spacious two to four bedroom apartments with exclusive hotel services, and a top-floor penthouse. Complete family privacy, 24-hour security and daily cleaning, in New Cairo (Tagamoa).',
    highlights: APARTMENT_HIGHLIGHTS, imageUrl: IMG('36377055'), sortOrder: 11,
  },
  {
    type: 'apartment', slug: 'executive-vip-studio', categoryEn: 'Executive Studio', categoryAr: 'استوديوهات تنفيذية',
    nameAr: 'استوديوهات VIP تنفيذية فاخرة', nameEn: 'Executive VIP Studios',
    descriptionAr:
      'استوديوهات فاخرة مجهزة بالكامل ومصممة لمسافري الأعمال والضيوف الفرديين VIP.',
    descriptionEn:
      'Fully equipped luxury studios designed for business travellers and individual VIP guests.',
    highlights: [
      { ar: 'مجهزة بالكامل', en: 'Fully equipped' },
      { ar: 'لرجال الأعمال', en: 'For business travellers' },
      { ar: 'الضيوف الفرديين VIP', en: 'For individual VIP guests' },
      { ar: 'مواقع راقية', en: 'Prime locations' },
    ],
    imageUrl: IMG('36224723'), sortOrder: 12,
  },
];

export const CATALOGUE: SeedService[] = [...FASTTRACK, ...CARS, ...HOTELS, ...APARTMENTS];
