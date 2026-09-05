/**
 * Office contact details, confirmed in the specification.
 * Kept in one place so the number appears identically everywhere.
 */
export const OFFICE_PHONE = '+201222332929';
export const OFFICE_PHONE_DISPLAY = '+20 122 233 2929';

export function whatsappLink(message?: string): string {
  const digits = OFFICE_PHONE.replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

export const telLink = `tel:${OFFICE_PHONE}`;
