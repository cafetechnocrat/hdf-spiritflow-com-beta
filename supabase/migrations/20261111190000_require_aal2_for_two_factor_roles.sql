-- Phase 1: two-factor is enforced in the database too.
-- A user in a two-factor role matches no role policy until the session has
-- passed the authenticator check (aal2). They can still read their own profile,
-- which the setup and verify screens need.
-- Apply this AFTER the two-factor screens are live, or those roles lose access.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active'
    and (
      p.role not in ('md', 'system_admin', 'chief_accountant', 'accounts_staff')
      or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    );
$$;
