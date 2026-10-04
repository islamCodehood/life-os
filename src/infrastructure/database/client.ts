import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { requireRuntimeDatabaseUrl } from '@/src/infrastructure/env/server';
import * as schema from './schema';

export function createDatabase() {
  const pool = new Pool({
    connectionString: requireRuntimeDatabaseUrl(),
    max: 5,
  });

  return {
    pool,
    db: drizzle(pool, { schema }),
  };
}
