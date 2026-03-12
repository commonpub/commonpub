// Singleton Drizzle DB instance for Nitro server
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

let db: ReturnType<typeof drizzle> | null = null;

export function useDB(): ReturnType<typeof drizzle> {
  if (db) return db;

  const config = useRuntimeConfig();
  const databaseUrl = config.databaseUrl as string;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured. Set NUXT_DATABASE_URL environment variable.');
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  db = drizzle(pool);

  return db;
}
