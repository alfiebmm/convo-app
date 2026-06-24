-- CON-220 prerequisite / ADMIN-1 follow-up:
-- Backfill `is_platform_staff = true` for the founders' email addresses
-- so they can access /platform-admin/* in production.
--
-- Safe to re-run: the WHERE clause only flips rows that haven't already
-- been flipped, and missing emails are simply no-ops (the founder hasn't
-- signed in yet).

UPDATE users
SET is_platform_staff = true
WHERE email IN (
  'blake.d.mitchell@gmail.com',
  'cameronbeach1@gmail.com'
)
AND is_platform_staff = false;
--> statement-breakpoint
