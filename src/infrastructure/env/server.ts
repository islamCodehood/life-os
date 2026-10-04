import { serverEnvSchema, type ServerEnv } from './schema';

export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}

export function requireRuntimeDatabaseUrl(env: ServerEnv = getServerEnv()): string {
  if (!env.DATABASE_URL_RUNTIME) {
    throw new Error('DATABASE_URL_RUNTIME is required for database operations.');
  }

  return env.DATABASE_URL_RUNTIME;
}
