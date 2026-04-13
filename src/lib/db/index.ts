import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

/**
 * DB connection using node-postgres.
 * Works in both local dev and Vercel serverless (Node.js runtime).
 *
 * Note: Vercel API routes default to Node.js runtime (not Edge),
 * so node-postgres works fine. If we ever need Edge runtime,
 * we'd switch to Neon or Supabase's HTTP driver.
 */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 5, // limit pool size for serverless
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
