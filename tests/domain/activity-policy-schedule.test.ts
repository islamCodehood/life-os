import { describe, expect, it } from 'vitest';
import { resolveActivityPolicy } from '@/src/domain/activity/policy';
import {
  buildDailyOpportunityWindow,
  initialDailyActiveDate,
  localDateInTimezone,
} from '@/src/domain/activity/schedule';

describe('activity policy', () => {
  it('keeps ordinary self responsibilities non-monetary', () => {
    const policy = resolveActivityPolicy('SELF_RESPONSIBILITY');

    expect(policy.progressMode).toBe('INDEPENDENCE');
    expect(policy.money).toBe('FORBIDDEN');
    expect(policy.xp).toBe('TRAINING_ONLY');
    expect(policy.approvalDefault).toBe('NONE');
    expect(policy.graduationEligible).toBe(true);
  });

  it('keeps values and faith out of XP', () => {
    expect(resolveActivityPolicy('VALUES').xp).toBe('FORBIDDEN');
    expect(resolveActivityPolicy('FAITH').xp).toBe('FORBIDDEN');
  });
});

describe('daily opportunity schedule', () => {
  it('builds availability, target, and opportunity-end timestamps from local schedule', () => {
    const window = buildDailyOpportunityWindow({
      date: '2026-10-05',
      timezone: 'UTC',
      localTargetTime: '07:00',
      availableOffsetMinutes: -60,
      opportunityEndOffsetMinutes: 180,
    });

    expect(window.availableFrom.toISOString()).toBe('2026-10-05T06:00:00.000Z');
    expect(window.targetAt.toISOString()).toBe('2026-10-05T07:00:00.000Z');
    expect(window.opportunityEndsAt.toISOString()).toBe('2026-10-05T10:00:00.000Z');
  });

  it('starts today before the availability window and tomorrow after it opens', () => {
    const common = {
      timezone: 'UTC',
      localTargetTime: '07:00',
      availableOffsetMinutes: -60,
    };

    expect(initialDailyActiveDate({ ...common, now: new Date('2026-10-05T05:59:00.000Z') })).toBe(
      '2026-10-05',
    );
    expect(initialDailyActiveDate({ ...common, now: new Date('2026-10-05T06:00:00.000Z') })).toBe(
      '2026-10-06',
    );
  });

  it('uses the family timezone when deriving the local date', () => {
    expect(localDateInTimezone('Africa/Cairo', new Date('2026-10-04T22:30:00.000Z'))).toBe(
      '2026-10-05',
    );
  });
});
