import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('E1 identity migrations', () => {
  it('creates the required identity/session tables and stores hashes rather than raw credentials', () => {
    const identity = fs.readFileSync('drizzle/0001_family_identity.sql', 'utf8');
    const sessions = fs.readFileSync('drizzle/0002_devices_and_child_sessions.sql', 'utf8');
    const combined = identity + sessions;

    for (const table of [
      'families',
      'guardian_profiles',
      'family_guardians',
      'child_profiles',
      'experience_preferences',
      'household_devices',
      'child_pin_credentials',
      'child_sessions',
    ]) {
      expect(combined).toContain(`"${table}"`);
    }

    expect(sessions).toContain('"pin_hash"');
    expect(sessions).toContain('"token_hash"');
    expect(sessions).not.toContain('"raw_token"');
    expect(sessions).not.toContain('"pin" text');
  });
});
