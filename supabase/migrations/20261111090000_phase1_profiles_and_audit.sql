-- Phase 1, first slice: roles, profiles and the audit log.
-- Outlets, counters and outlet access arrive in a later slice.

create type public.user_role as enum (
  'md',
  'system_admin',
  'chief_accountant',
  'accounts_staff',
  'night_accountant',
  'cashier',
  'stock_keeper',
  'security',
  'kitchen_staff'
);

create type public.user_status as enum ('active', 'inactive');

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) > 0),
  role public.user_role not null,
  username text unique,
  phone text,
  status public.user_status not null default 'active',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- Audit log -----------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (
    action in ('insert', 'update', 'void', 'login', 'logout', 'failed_login')
  ),
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);

-- Role helper ---------------------------------------------------------------
-- Reads the role from profiles only, never from user metadata.
-- Returns null for inactive or unknown users, so they match no policy.

create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active';
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Triggers ------------------------------------------------------------------

create function public.set_updated_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger profiles_set_updated
  before update on public.profiles
  for each row execute function public.set_updated_fields();

create function public.write_audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'insert', tg_table_name, new.id, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), 'update', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
  end if;
  return null;
end;
$$;

revoke all on function public.write_audit_row() from public, anon, authenticated;

create trigger profiles_audit
  after insert or update on public.profiles
  for each row execute function public.write_audit_row();

-- The audit log can never be changed or removed, by anyone.
create function public.block_audit_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The audit log cannot be changed or deleted.';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.block_audit_changes();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.block_audit_changes();

-- Row Level Security --------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.audit_log to authenticated;

-- Everyone reads their own profile. Senior roles read all profiles.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.current_user_role()) in ('md', 'system_admin', 'chief_accountant')
  );

-- Only System Admin creates or changes profiles. There is no delete policy.
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.current_user_role()) = 'system_admin');

create policy profiles_update on public.profiles
  for update to authenticated
  using ((select public.current_user_role()) = 'system_admin')
  with check ((select public.current_user_role()) = 'system_admin');

-- Audit log is readable by MD, System Admin and Chief Accountant.
-- Rows are written only by triggers and server code, never by app roles.
create policy audit_log_select on public.audit_log
  for select to authenticated
  using ((select public.current_user_role()) in ('md', 'system_admin', 'chief_accountant'));
