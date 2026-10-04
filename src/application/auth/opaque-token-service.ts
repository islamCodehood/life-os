export type OpaqueTokenPurpose = 'device' | 'child-session';

export interface OpaqueTokenService {
  issue(purpose: OpaqueTokenPurpose): { rawToken: string; tokenHash: string };
  hash(rawToken: string, purpose: OpaqueTokenPurpose): string;
}
