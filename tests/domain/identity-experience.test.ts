import { describe, expect, it } from 'vitest';
import {
  deriveAgeProfile,
  recommendedVisualization,
} from '@/src/domain/identity/experience';

describe('age-adaptive experience', () => {
  it.each([
    ['2020-10-04', '2026-10-04', 'EXPLORER'],
    ['2018-10-04', '2026-10-04', 'EXPLORER'],
    ['2017-10-04', '2026-10-04', 'BUILDER'],
    ['2014-10-04', '2026-10-04', 'BUILDER'],
    ['2013-10-04', '2026-10-04', 'NAVIGATOR'],
    ['2011-10-04', '2026-10-04', 'NAVIGATOR'],
    ['2010-10-04', '2026-10-04', 'LAUNCH'],
    ['2009-10-04', '2026-10-04', 'LAUNCH'],
  ] as const)('derives %s at %s as %s', (birthDate, asOf, expected) => {
    expect(deriveAgeProfile(birthDate, asOf)).toBe(expected);
  });

  it('keeps unsupported ages out of parent-managed defaults', () => {
    expect(deriveAgeProfile('2021-10-04', '2026-10-04')).toBeNull();
    expect(deriveAgeProfile('2008-10-04', '2026-10-04')).toBeNull();
  });

  it('uses age only for recommended visualization, not capability', () => {
    expect(recommendedVisualization('EXPLORER')).toBe('IMMERSIVE');
    expect(recommendedVisualization('BUILDER')).toBe('BALANCED');
    expect(recommendedVisualization('NAVIGATOR')).toBe('FOCUSED');
    expect(recommendedVisualization('LAUNCH')).toBe('FOCUSED');
  });
});
