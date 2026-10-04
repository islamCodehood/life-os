import { describe, expect, it } from 'vitest';
import type { FamilyId, GuardianId } from '@/src/domain/shared/id';
import {
  decodeParentUnlock,
  encodeParentUnlock,
} from '@/src/infrastructure/auth/parent-unlock-codec';

describe('parent unlock cookie', () => {
  it('verifies before expiry and rejects after expiry', () => {
    const token = encodeParentUnlock(
      {
        familyId: '01900000-0000-7000-8000-000000000001' as FamilyId,
        guardianId: '01900000-0000-7000-8000-000000000002' as GuardianId,
        expiresAtEpochSeconds: 1_000,
      },
      'test-secret',
    );

    expect(decodeParentUnlock(token, 'test-secret', 999)?.expiresAtEpochSeconds).toBe(1_000);
    expect(decodeParentUnlock(token, 'test-secret', 1_000)).toBeNull();
    expect(decodeParentUnlock(token, 'wrong-secret', 999)).toBeNull();
  });
});
