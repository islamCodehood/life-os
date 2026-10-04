import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from '@/src/infrastructure/database/client';
import { getServerEnv } from '@/src/infrastructure/env/server';

const env = getServerEnv();
const run = env.RUN_DB_SMOKE === '1';

describe.skipIf(!run)('database smoke', () => {
  let close: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await close?.();
  });

  it('connects and can see the private life_os schema', async () => {
    const { pool } = createDatabase();
    close = () => pool.end();

    const result = await pool.query<{ exists: boolean }>(
      "select exists(select 1 from information_schema.schemata where schema_name = 'life_os') as exists",
    );

    expect(result.rows[0]?.exists).toBe(true);
  });
});
