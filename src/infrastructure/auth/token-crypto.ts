import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type TokenPurpose = 'device' | 'child-session' | 'parent-unlock';

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string, secret: string, purpose: TokenPurpose): string {
  return createHmac('sha256', secret).update(purpose).update('\0').update(token).digest('hex');
}

export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
