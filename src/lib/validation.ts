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
export const inquiryStatusSchema = z.enum(['new', 'contacted', 'confirmed', 'closed']);
export const inquirySourceSchema = z.enum(['website', 'whatsapp', 'phone', 'staff_manual']);
export const roleSchema = z.enum(['admin', 'staff']);

/**
 * What the public request form may send.
 *
 * Only the name and phone are required — the office needs a way to call back
 * and nothing else. Dates are a preference, not a reservation, so they are
 * optional and are never checked against a calendar.
 */
export const publicInquirySchema = z.object({
  serviceId: z.uuid().optional().nullable(),
  customerName: name,
  customerPhone: phone,
  customerEmail: optionalEmail,
  country: z.string().trim().max(80).optional().nullable(),
  preferredStart: z.union([dateString, z.literal('')]).optional().nullable(),
  preferredEnd: z.union([dateString, z.literal('')]).optional().nullable(),
  partySize: z.coerce.number().int().min(1).max(50).optional().nullable(),
  flightNumber: z.string().trim().max(20).optional().nullable(),
  message: z.string().trim().max(2000).optional(),
});

/** Staff logging a request that arrived by phone or WhatsApp. */
export const staffInquirySchema = publicInquirySchema.extend({
  source: inquirySourceSchema.optional(),
  staffNotes: z.string().trim().max(2000).optional(),
});

export const updateInquirySchema = z.object({
  status: inquiryStatusSchema.optional(),
  staffNotes: z.string().trim().max(2000).optional(),
});

export const inquiryListQuerySchema = z.object({
  status: z.string().optional(),
  serviceId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const serviceSchema = z.object({
  type: serviceTypeSchema,
  highlights: z
    .array(z.object({ ar: z.string().trim().max(200), en: z.string().trim().max(200) }))
    .max(12)
    .optional(),
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
  imageUrl: z.union([z.url(), z.literal('')]).optional().nullable(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const serviceUpdateSchema = serviceSchema.partial();

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

