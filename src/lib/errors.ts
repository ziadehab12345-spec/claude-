/** Application error types. Each maps to a stable HTTP status and error code. */

export type AppErrorCode =
  | 'validation_error'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'unavailable'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error';

const STATUS: Record<AppErrorCode, number> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  unavailable: 409,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const validationError = (m: string, d?: unknown) => new AppError('validation_error', m, d);
export const notFound = (m = 'Not found') => new AppError('not_found', m);
export const unauthenticated = (m = 'Sign in required') => new AppError('unauthenticated', m);
export const forbidden = (m = 'You do not have access to this action') => new AppError('forbidden', m);
export const unavailable = (m: string, d?: unknown) => new AppError('unavailable', m, d);
export const rateLimited = (m = 'Too many requests. Please try again shortly.') =>
  new AppError('rate_limited', m);

/** Postgres raises 23P01 (exclusion_violation) when bookings_no_overlap fires. */
export function isExclusionViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23P01';
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/** Postgres raises 40001 on a serialization failure; the caller may retry. */
export function isSerializationFailure(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '40001';
}
