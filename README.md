# Convo

> AI chatbot that turns website conversations into SEO-optimised content.

**Status:** Phase 1 — Foundation

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Styling:** Tailwind CSS
- **Auth:** TBD (Clerk or NextAuth)
- **LLM:** OpenAI (GPT-4o-mini for chat, GPT-4o for content)
- **Hosting:** Vercel

## Getting Started

```bash
cp .env.example .env.local
# Fill in DATABASE_URL
npm install
npm run dev
```

## Database migrations

Full runbook: [`docs/migrations.md`](docs/migrations.md).

- `npm run migrate` — apply pending Drizzle migrations against
  `$DATABASE_URL`. Wired into the Vercel `buildCommand` and gated on
  `VERCEL_ENV=production`.
- `npm run migrate:dry-run` — show what would be applied; touch nothing.
- `npm run migrate:baseline` — seed `drizzle.__drizzle_migrations` for an
  environment whose schema is already up to date (one-shot per env).
- `npm run migrate:check` — CI guard run on every PR touching `drizzle/`.

## Project Structure

```
src/
├── app/
│   ├── api/chat/       # Widget → conversation engine endpoint
│   ├── dashboard/      # Multi-tenant dashboard
│   │   ├── conversations/
│   │   ├── content/
│   │   ├── widget/
│   │   └── settings/
│   └── page.tsx        # Landing page
├── config/
│   └── app.ts          # Config-driven branding (rename in one place)
└── lib/
    ├── db/
    │   ├── schema.ts   # Drizzle schema (all tables)
    │   └── index.ts    # DB connection
    └── tenant.ts       # Multi-tenant utilities
```

## Build Phases

1. ✅ **Foundation** — DB schema, auth, multi-tenant core, dashboard shell
2. 🔲 **Chat Widget** — Embeddable Preact widget, WebSocket, conversation engine
3. 🔲 **Content Pipeline** — Topic extraction, dedup, article generation
4. 🔲 **Publishing** — Review queue, WP integration, auto-publish
5. 🔲 **Forum/Q&A** — Browsable threads, SEO pages
6. 🔲 **Polish & Launch** — Analytics, onboarding, Stripe billing
