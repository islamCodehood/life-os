import { describe, expect, it } from 'vitest';
import {
  reviewWindow,
  shiftDate,
  validateFocus,
  validateReflection,
  presentation,
  canEditReview,
  prompts,
} from '@/src/domain/weekly-review/review';
describe('E11 local calendar review scheduling', () => {
  it('uses the family-local configured weekday, not the UTC day or a fixed weekly ISO grouping', () => {
    expect(reviewWindow('2026-10-12', 5)).toEqual({
      reviewOn: '2026-10-09',
      weekStart: '2026-10-02',
      weekEnd: '2026-10-09',
    });
    expect(reviewWindow('2026-10-09', 5).reviewOn).toBe('2026-10-09');
    expect(reviewWindow('2026-10-13', null).reviewOn).toBe('2026-10-09');
    expect(reviewWindow('2027-01-01', 0)).toEqual({
      reviewOn: '2026-12-27',
      weekStart: '2026-12-20',
      weekEnd: '2026-12-27',
    });
    expect(shiftDate('2027-01-01', -7)).toBe('2026-12-25');
    expect(() => reviewWindow('2026-10-12', 8)).toThrow();
    expect(() => reviewWindow('2026-02-30', 5)).toThrow();
  });
  it('keeps skipped and abandoned weeks closed with no penalty, XP or judgement', () => {
    expect(canEditReview('OPEN')).toBe(true);
    for (const status of ['COMPLETED', 'SKIPPED', 'ABANDONED'] as const)
      expect(canEditReview(status)).toBe(false);
  });
  it('lets the child choose which reflection questions to answer', () => {
    expect(prompts).toEqual(['PROUD', 'DIFFICULT', 'LEARNED', 'HELPED', 'IMPROVE', 'NEXT_FOCUS']);
    expect(validateReflection('  I learned chess  ')).toBe('I learned chess');
    expect(() => validateReflection('  ')).toThrow();
    expect(() => validateReflection('x'.repeat(1201))).toThrow();
    expect(validateFocus('  Read together  ')).toBe('Read together');
    expect(() => validateFocus('a')).toThrow();
  });
  it('adapts copy density, not authority or underlying facts', () => {
    expect(presentation('EXPLORER')).toBe('ILLUSTRATED');
    expect(presentation('BUILDER')).toBe('CARD');
    expect(presentation('NAVIGATOR')).toBe('REFLECTION');
    expect(presentation('LAUNCH')).toBe('REFLECTION');
  });
});
