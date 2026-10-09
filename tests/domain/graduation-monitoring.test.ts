import { describe, expect, it } from 'vitest';
import { monitoringState } from '@/src/domain/graduation/monitoring';

const approvedAt = new Date('2026-10-01T00:00:00Z');
const observedAt = new Date('2026-10-05T00:00:00Z');
const now = new Date('2026-10-06T00:00:00Z');

describe('graduation monitoring', () => {
  const input = { approvedAt, lastObservedAt: observedAt, monitoringIntervalDays: 14, now };
  it('keeps a single concern as watch, never automatic reactivation', () => {
    expect(monitoringState({ ...input, observations: [{ result: 'NEEDS_REGULAR_SUPPORT', observedAt }] })).toBe('WATCH');
  });
  it('suggests review only after consecutive regular support observations', () => {
    expect(monitoringState({ ...input, observations: [
      { result: 'NEEDS_REGULAR_SUPPORT', observedAt },
      { result: 'NEEDS_REGULAR_SUPPORT', observedAt: new Date('2026-10-04T00:00:00Z') },
    ] })).toBe('REACTIVATION_REVIEW');
    expect(monitoringState({ ...input, observations: [
      { result: 'NEEDS_REGULAR_SUPPORT', observedAt },
      { result: 'STABLE', observedAt: new Date('2026-10-04T00:00:00Z') },
    ] })).toBe('WATCH');
  });
  it('reports an overdue check-in as uncertainty, not regression', () => {
    expect(monitoringState({ ...input, lastObservedAt: null, observations: [], now: new Date('2026-10-20T00:00:00Z') })).toBe('OVERDUE');
  });
  it('treats a stable recent observation as stable', () => {
    expect(monitoringState({ ...input, observations: [{ result: 'STABLE', observedAt }] })).toBe('STABLE');
  });
});
