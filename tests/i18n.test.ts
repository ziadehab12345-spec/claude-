import { describe, it, expect } from 'vitest';
import ar from '../messages/ar.json';
import en from '../messages/en.json';

/** Both locales are first-class. A key present in one must exist in the other. */
function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('translations', () => {
  it('has identical key sets in Arabic and English', () => {
    const a = flatten(ar).sort();
    const e = flatten(en).sort();
    expect(a).toEqual(e);
  });

  it('has no empty strings', () => {
    for (const [name, messages] of [['ar', ar], ['en', en]] as const) {
      const walk = (o: Record<string, unknown>, path = ''): void => {
        for (const [k, v] of Object.entries(o)) {
          const key = path ? `${path}.${k}` : k;
          if (typeof v === 'string') expect(v.trim(), `${name}.${key}`).not.toBe('');
          else if (v && typeof v === 'object') walk(v as Record<string, unknown>, key);
        }
      };
      walk(messages as Record<string, unknown>);
    }
  });
});
