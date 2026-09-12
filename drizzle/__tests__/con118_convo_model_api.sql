-- CON-118 migration smoke: forward columns/indexes and review rollback.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE conversation_status AS ENUM ('active', 'completed', 'archived');
CREATE TYPE plan AS ENUM ('starter', 'growth', 'scale');
CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete'
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  slug varchar(63) NOT NULL UNIQUE,
  plan plan NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  visitor_id varchar(255),
  status conversation_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}',
  message_count integer NOT NULL DEFAULT 0,
  needs_followup boolean NOT NULL DEFAULT false,
  follow_up_type varchar(20),
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamp with time zone NOT NULL DEFAULT NOW(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

\i drizzle/0029_con118_convo_model_api.sql

SELECT title, topic, persona, ai_summary, summary_generated_at, last_activity_at
  FROM conversations
 LIMIT 0;

SELECT indexname
  FROM pg_indexes
 WHERE tablename = 'conversations'
   AND indexname IN (
     'conversations_tenant_last_activity_idx',
     'conversations_tenant_persona_idx',
     'conversations_tenant_topic_idx'
   );

ALTER TABLE conversations
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS topic,
  DROP COLUMN IF EXISTS persona,
  DROP COLUMN IF EXISTS ai_summary,
  DROP COLUMN IF EXISTS summary_generated_at,
  DROP COLUMN IF EXISTS last_activity_at;

SELECT 1;

ROLLBACK;
