-- =============================================================================
-- Function execution grants (defence in depth).
--
-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default. Every user-facing function already checks auth.uid()/is_admin()
-- internally, but anonymous visitors should only be able to execute the few
-- functions that public pages and public RLS policies need.
--
-- NOTE: functions added in later migrations are again granted to anon by
-- default; revoke explicitly when adding non-public functions.
-- =============================================================================

revoke execute on all functions in schema public from public, anon;

-- Needed by RLS policies on publicly readable tables and storage objects.
grant execute on function public.is_admin() to anon;
grant execute on function public.has_role(public.app_role) to anon;
grant execute on function public.is_public_specialist(uuid) to anon;
grant execute on function public.is_direct_user_request() to anon;

-- Public discovery.
grant execute on function public.escape_like(text) to anon;
grant execute on function public.search_services(text, text, bigint, bigint, integer, numeric, public.availability_status, text, uuid, text, integer, integer) to anon;
grant execute on function public.search_specialists(text, text, text, public.availability_status, bigint, public.experience_level, numeric, text, integer, integer) to anon;
grant execute on function public.get_specialist_reputation(uuid) to anon;
