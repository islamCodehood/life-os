import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from '@/src/infrastructure/env/public';
import { parseServerEnv, requireRuntimeDatabaseUrl } from '@/src/infrastructure/env/server';

describe('environment validation', () => {
  it('allows a shell without future optional credentials and supplies E1 operational defaults', () => {
    const env = parseServerEnv({});
    expect(env.RUN_DB_SMOKE).toBe('0');
    expect(env.CHILD_SESSION_TTL_SECONDS).toBe(2_592_000);
    expect(env.PARENT_UNLOCK_TTL_SECONDS).toBe(300);
    expect(env.PIN_MAX_ATTEMPTS).toBe(5);
    expect(parsePublicEnv({}).NEXT_PUBLIC_APP_ORIGIN).toBe('http://localhost:3000');
  });

  it('rejects malformed configured URLs and invalid PIN bounds', () => {
    expect(() => parseServerEnv({ DATABASE_URL_RUNTIME: 'not-a-url' })).toThrow();
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_ORIGIN: 'not-a-url' })).toThrow();
    expect(() => parseServerEnv({ PIN_MIN_LENGTH: '9', PIN_MAX_LENGTH: '4' })).toThrow();
  });

  it('requires a runtime DB URL only when database access is attempted', () => {
    expect(() => requireRuntimeDatabaseUrl(parseServerEnv({}))).toThrow(
      'DATABASE_URL_RUNTIME is required for database operations.',
    );
  });
});
