import { describe, expect, it } from 'vitest';
import { Argon2PinHasher } from '@/src/infrastructure/auth/argon2-pin-hasher';

describe('Argon2 PIN hashing', () => {
  it('stores an Argon2id hash and verifies without retaining the PIN', async () => {
    const hasher = new Argon2PinHasher();
    const hash = await hasher.hash('4729');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('4729');
    await expect(hasher.verify(hash, '4729')).resolves.toBe(true);
    await expect(hasher.verify(hash, '1111')).resolves.toBe(false);
  });
});
