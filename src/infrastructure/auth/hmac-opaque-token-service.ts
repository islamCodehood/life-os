import { createHmac, randomBytes } from 'node:crypto';
import type {
  OpaqueTokenPurpose,
  OpaqueTokenService,
} from '@/src/application/auth/opaque-token-service';

export class HmacOpaqueTokenService implements OpaqueTokenService {
  constructor(private readonly secret: string) {}

  issue(purpose: OpaqueTokenPurpose) {
    const rawToken = randomBytes(32).toString('base64url');
    return {
      rawToken,
      tokenHash: this.hash(rawToken, purpose),
    };
  }

  hash(rawToken: string, purpose: OpaqueTokenPurpose): string {
    return createHmac('sha256', this.secret)
      .update(purpose)
      .update('\0')
      .update(rawToken)
      .digest('hex');
  }
}
