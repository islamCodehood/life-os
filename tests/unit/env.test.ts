import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from '@/src/infrastructure/env/public';
import { parseServerEnv, requireRuntimeDatabaseUrl } from '@/src/infrastructure/env/server';

describe('environment validation', () => {
  it('allows an E0 shell without future optional credentials', () => {
    expect(parseServerEnv({}).RUN_DB_SMOKE).toBe('0');
    expect(parsePublicEnv({}).NEXT_PUBLIC_APP_ORIGIN).toBe('http://localhost:3000');
  });

  it('rejects malformed configured URLs', () => {
    expect(() => parseServerEnv({ DATABASE_URL_RUNTIME: 'not-a-url' })).toThrow();
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_ORIGIN: 'not-a-url' })).toThrow();
  });

  it('requires a runtime DB URL only when database access is attempted', () => {
    expect(() => requireRuntimeDatabaseUrl(parseServerEnv({}))).toThrow(
      'DATABASE_URL_RUNTIME is required for database operations.',
    );
  });
});
