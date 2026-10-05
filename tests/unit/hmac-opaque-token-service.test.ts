import { describe, expect, it } from 'vitest';
import { HmacOpaqueTokenService } from '@/src/infrastructure/auth/hmac-opaque-token-service';

describe('HmacOpaqueTokenService', () => {
  it('hashes child-session tokens before persistence', () => {
    const service = new HmacOpaqueTokenService('a sufficiently long test secret');
    const issued = service.issueDeterministic('child-session', 'session-seed');

    expect(issued.rawToken).not.toBe(issued.tokenHash);
    expect(issued.tokenHash).toBe(service.hash(issued.rawToken, 'child-session'));
    expect(issued.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('domain-separates device and child-session hashes', () => {
    const service = new HmacOpaqueTokenService('a sufficiently long test secret');
    const rawToken = 'same-raw-token';

    expect(service.hash(rawToken, 'device')).not.toBe(service.hash(rawToken, 'child-session'));
  });
});
