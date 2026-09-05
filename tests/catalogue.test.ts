import { describe, it, expect } from 'vitest';
import { CATALOGUE } from '../db/catalogue';

/**
 * The catalogue is imported from the office's existing site. These tests hold
 * the line on the two things that site does not publish, so a future edit
 * cannot quietly slip an invented price or a fabricated inventory count into
 * the seed.
 */
describe('seeded catalogue', () => {
  it('carries no price at all', () => {
    // Every price must come from the dashboard. If a `price` field ever
    // appears here, this fails.
    for (const s of CATALOGUE) {
      expect(Object.keys(s)).not.toContain('basePriceMinor');
      expect(Object.keys(s)).not.toContain('price');
    }
  });

  it('claims no real inventory beyond a single placeholder per property', () => {
    // Fast Track rep capacity is the one place a count is guessed, and it is
    // flagged as a placeholder in the dashboard.
    for (const s of CATALOGUE) {
      if (s.type === 'fasttrack') expect(s.placeholderUnits).toBeLessThanOrEqual(5);
      else expect(s.placeholderUnits).toBe(1);
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
