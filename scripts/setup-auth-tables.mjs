import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:VguUV6lZYC1bQC2O@db.vaywizrracxjjkhjzede.supabase.co:5432/postgres",
});

async function run() {
  // Add NextAuth columns to users
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified" timestamptz;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;
  `);
  console.log("✅ users table updated with NextAuth columns");

  // Create accounts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type text NOT NULL,
      provider text NOT NULL,
      "providerAccountId" text NOT NULL,
      refresh_token text,
      access_token text,
      expires_at integer,
      token_type text,
      scope text,
      id_token text,
      session_state text,
      PRIMARY KEY (provider, "providerAccountId")
    );
  `);
  console.log("✅ accounts table created");

  // Create sessions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      "sessionToken" text PRIMARY KEY,
      "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires timestamptz NOT NULL
    );
  `);
  console.log("✅ sessions table created");

  // Create verification_tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier text NOT NULL,
      token text NOT NULL,
      expires timestamptz NOT NULL,
      PRIMARY KEY (identifier, token)
    );
  `);
  console.log("✅ verification_tokens table created");

  // Insert Blake's user and link to Doggo tenant
  const user = await pool.query(
    `INSERT INTO users (email, name, "emailVerified")
     VALUES ('blake@doggo.com.au', 'Blake Mitchell', NOW())
     ON CONFLICT (email) DO UPDATE SET name = 'Blake Mitchell', "emailVerified" = NOW()
     RETURNING id, email, name`
  );
  console.log("✅ USER:", user.rows[0]);

  const userId = user.rows[0].id;
  const tenantId = "43083805-7fe5-4381-9fc4-b0535d5003d2"; // Doggo

  const member = await pool.query(
    `INSERT INTO tenant_members (user_id, tenant_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT DO NOTHING
     RETURNING user_id, role`,
    [userId, tenantId]
  );
  console.log("✅ MEMBER:", member.rows[0] || "(already linked)");

  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
