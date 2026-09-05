/**
 * Request validation. Nothing reaches the database or the availability engine
 * without passing through one of these schemas first.
 */
import { z } from 'zod';
import { isValidDateString } from './dates';

const dateString = z
  .string()
  .refine(isValidDateString, { message: 'Must be a valid YYYY-MM-DD date' });

/** E.164-ish. Gulf and Egyptian numbers both fit; we do not verify the number. */
const phone = z
  .string()
  .trim()
  .min(7, 'Phone number is too short')
  .max(24, 'Phone number is too long')
  .regex(/^\+?[0-9\s()-]+$/, 'Phone number contains invalid characters');

const name = z.string().trim().min(2, 'Name is too short').max(120, 'Name is too long');
const optionalEmail = z.union([z.email('Invalid email address'), z.literal('')]).optional().nullable();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Must be a valid HH:MM time');

export const serviceTypeSchema = z.enum(['car', 'hotel', 'apartment', 'fasttrack']);
export const bookingStatusSchema = z.enum(['pending', 'confirmed', 'cancelled', 'completed']);
export const paymentStatusSchema = z.enum(['unpaid', 'partial', 'paid']);
export const roleSchema = z.enum(['admin', 'staff']);

export const dateRangeSchema = z
  .object({ startDate: dateString, endDate: dateString })
  .refine((v) => v.endDate > v.startDate, {
    message: 'end_date must be after start_date',
    path: ['endDate'],
  });

export const availabilityQuerySchema = z.object({
  serviceId: z.uuid().optional(),
  serviceSlug: z.string().trim().min(1).max(120).optional(),
  startDate: dateString,
  endDate: dateString,
});

export const calendarQuerySchema = z.object({
  from: dateString,
  to: dateString,
  serviceType: serviceTypeSchema.optional(),
  serviceId: z.uuid().optional(),
});

/** What the public booking form may send. Price and status are NOT accepted. */
export const publicBookingSchema = z.object({
  unitId: z.uuid(),
  customerName: name,
  customerPhone: phone,
  customerEmail: optionalEmail,
  startDate: dateString,
  endDate: dateString,
  flightTime: time.optional().nullable(),
  flightNumber: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
});

/** Staff may additionally set price, status, payment state and internal notes. */
export const staffBookingSchema = publicBookingSchema.extend({
  priceMinorOverride: z.number().int().min(0).optional().nullable(),
  status: z.enum(['pending', 'confirmed']).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentNotes: z.string().trim().max(2000).optional(),
});

export const updateBookingSchema = z.object({
  customerName: name.optional(),
  customerPhone: phone.optional(),
  customerEmail: optionalEmail,
  priceMinor: z.number().int().min(0).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentNotes: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  flightTime: time.optional().nullable(),
  flightNumber: z.string().trim().max(20).optional().nullable(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  unitId: z.uuid().optional(),
});

export const statusChangeSchema = z.object({
  status: bookingStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const serviceSchema = z.object({
  type: serviceTypeSchema,
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may contain lowercase letters, numbers and hyphens only'),
  categoryEn: z.string().trim().min(1).max(120),
  categoryAr: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  descriptionAr: z.string().trim().max(4000).optional(),
  descriptionEn: z.string().trim().max(4000).optional(),
  basePriceMinor: z.number().int().min(0),
  imageUrl: z.union([z.url(), z.literal('')]).optional().nullable(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const serviceUpdateSchema = serviceSchema.partial();

export const unitSchema = z.object({
  serviceId: z.uuid(),
  identifier: z.string().trim().min(1).max(120),
  labelAr: z.string().trim().max(200).optional(),
  labelEn: z.string().trim().max(200).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

export const unitUpdateSchema = unitSchema.partial().omit({ serviceId: true });

export const unitBlockSchema = z.object({
  unitId: z.uuid(),
  startDate: dateString,
  endDate: dateString,
  reason: z.string().trim().max(500).optional(),
});

export const createUserSchema = z.object({
  name: name,
  email: z.email(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(200),
  role: roleSchema,
});

export const updateUserSchema = z.object({
  name: name.optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(12).max(200).optional(),
});

export const bookingListQuerySchema = z.object({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  serviceType: serviceTypeSchema.optional(),
  serviceId: z.uuid().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
