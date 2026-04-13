import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import pg from "pg";
import * as schema from "./schema";

/**
 * Dual-driver DB connection:
 * - Vercel/serverless: uses Neon HTTP driver (works in edge/serverless)
 * - Local dev: uses node-postgres (works in Node.js)
 */
function createDb() {
  const url = process.env.DATABASE_URL!;

  if (process.env.VERCEL) {
    // Neon HTTP driver for serverless
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  }

  // node-postgres for local dev
  const pool = new pg.Pool({ connectionString: url });
  return drizzleNode(pool, { schema });
}

export const db = createDb();
export type Database = typeof db;
