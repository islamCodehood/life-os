import { hash, verify } from '@node-rs/argon2';
import type { PinHasher } from '@/src/application/auth/pin-hasher';

const policy = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export class Argon2PinHasher implements PinHasher {
  hash(pin: string): Promise<string> {
    return hash(pin, policy);
  }

  verify(hashValue: string, pin: string): Promise<boolean> {
    return verify(hashValue, pin);
  }
}
