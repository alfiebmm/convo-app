-- CON-217 / ADMIN-1: platform-admin enforcement foundation.

CREATE OR REPLACE FUNCTION public.is_platform_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
      AND is_platform_staff = true
  );
$$;
--> statement-breakpoint

ALTER FUNCTION public.is_platform_staff() OWNER TO postgres;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.is_platform_staff() FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.is_platform_staff() TO authenticated;
--> statement-breakpoint

COMMENT ON FUNCTION public.is_platform_staff() IS
  'CON-217 platform-admin RLS helper. True only when JWT sub maps to users.is_platform_staff = true.';
--> statement-breakpoint
