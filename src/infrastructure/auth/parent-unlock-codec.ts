import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FamilyId, GuardianId } from '@/src/domain/shared/id';

export interface ParentUnlockPayload {
  familyId: FamilyId;
  guardianId: GuardianId;
  expiresAtEpochSeconds: number;
}

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update('parent-unlock\0').update(payload).digest();
}

export function encodeParentUnlock(payload: ParentUnlockPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signature(encoded, secret).toString('base64url')}`;
}

export function decodeParentUnlock(
  value: string,
  secret: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): ParentUnlockPayload | null {
  const [encoded, supplied] = value.split('.');
  if (!encoded || !supplied) return null;

  const actual = signature(encoded, secret);
  let suppliedBytes: Buffer;

  try {
    suppliedBytes = Buffer.from(supplied, 'base64url');
  } catch {
    return null;
  }

  if (actual.length !== suppliedBytes.length || !timingSafeEqual(actual, suppliedBytes)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ParentUnlockPayload;
    if (
      typeof parsed.familyId !== 'string' ||
      typeof parsed.guardianId !== 'string' ||
      typeof parsed.expiresAtEpochSeconds !== 'number' ||
      parsed.expiresAtEpochSeconds <= nowEpochSeconds
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
