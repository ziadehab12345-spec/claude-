import { describe, it, expect } from 'vitest';
import { CATALOGUE } from '../db/catalogue';

/**
 * The catalogue is imported from the office's existing site. This site shows
 * what the office offers and hands the request over; it quotes nothing and
 * holds nothing. These tests keep a future edit from quietly reintroducing a
 * price or an inventory count.
 */
describe('seeded catalogue', () => {
  it('carries no price and no inventory count', () => {
    // The office quotes each request itself and holds no bookable inventory
    // here. If either concept ever reappears in the seed, this fails.
    for (const s of CATALOGUE) {
      const keys = Object.keys(s);
      for (const banned of ['basePriceMinor', 'price', 'currency', 'placeholderUnits', 'unitCount']) {
        expect(keys, `${s.slug} must not carry ${banned}`).not.toContain(banned);
      }
    }
  });

  it('has a unique slug for every service', () => {
    const slugs = CATALOGUE.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has Arabic and English for every name, description and highlight', () => {
    for (const s of CATALOGUE) {
      expect(s.nameAr.trim()).not.toBe('');
      expect(s.nameEn.trim()).not.toBe('');
      expect(s.descriptionAr.trim()).not.toBe('');
      expect(s.descriptionEn.trim()).not.toBe('');
      for (const h of s.highlights) {
        expect(h.ar.trim()).not.toBe('');
        expect(h.en.trim()).not.toBe('');
      }
    }
  });

  it('covers the four service types the office offers', () => {
    const types = new Set(CATALOGUE.map((s) => s.type));
    expect([...types].sort()).toEqual(['apartment', 'car', 'fasttrack', 'hotel']);
  });

  it('lists the twelve car models and the three Fast Track tiers', () => {
    expect(CATALOGUE.filter((s) => s.type === 'car')).toHaveLength(12);
    expect(CATALOGUE.filter((s) => s.type === 'fasttrack')).toHaveLength(3);
    expect(CATALOGUE.filter((s) => s.type === 'hotel')).toHaveLength(3);
  });
});
