-- Access by user. A role sets the limit. A user can be given less than their
-- role, never more. A row here exists only where a user is narrower than their
-- role. has_access() now combines the role and the user, so every policy,
-- every function and the app read the same combined access.

create table public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature_key text not null references public.features (key) on delete restrict,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index user_access_key on public.user_access (user_id, feature_key);

-- Rules ---------------------------------------------------------------------

create function public.check_user_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  f record;
  ra record;
begin
  select ro.id, ro.is_system into r
  from public.profiles p
  join public.roles ro on ro.id = p.role_id
  where p.id = new.user_id;
  if not found then
    raise exception 'That user was not found.';
  end if;
  if r.is_system then
    raise exception 'A System Admin always has full access and cannot be reduced.';
  end if;

  select ft.offers_view, ft.offers_edit, ft.offers_delete into f
  from public.features ft where ft.key = new.feature_key;
  if not found then
    raise exception 'That feature does not exist.';
  end if;
  if (new.can_view and not f.offers_view)
     or (new.can_edit and not f.offers_edit)
     or (new.can_delete and not f.offers_delete) then
    raise exception 'That feature does not offer this action.';
  end if;
  if f.offers_view and (new.can_edit or new.can_delete) and not new.can_view then
    raise exception 'Edit and Delete need View.';
  end if;

  -- Never more than the role allows.
  select a.can_view, a.can_edit, a.can_delete into ra
  from public.role_access a
  where a.role_id = r.id and a.feature_key = new.feature_key;
  if (new.can_view and not coalesce(ra.can_view, false))
     or (new.can_edit and not coalesce(ra.can_edit, false))
     or (new.can_delete and not coalesce(ra.can_delete, false)) then
    raise exception 'A user cannot have more access than their role.';
  end if;
  return new;
end;
$$;

create trigger user_access_check
  before insert or update on public.user_access
  for each row execute function public.check_user_access();

-- Changing a user's role clears their custom access, because the new role has
-- its own limits.
create function public.clear_user_access_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role_id is distinct from old.role_id then
    delete from public.user_access where user_id = new.id;
  end if;
  return null;
end;
$$;

create trigger profiles_clear_user_access
  after update of role_id on public.profiles
  for each row execute function public.clear_user_access_on_role_change();

-- Bookkeeping and audit -----------------------------------------------------

create trigger user_access_set_updated before update on public.user_access
  for each row execute function public.set_updated_fields();
create trigger user_access_audit
  after insert or update or delete on public.user_access
  for each row execute function public.write_audit_row();

-- Row Level Security --------------------------------------------------------

alter table public.user_access enable row level security;
revoke all on public.user_access from anon, authenticated;
grant select, insert, update, delete on public.user_access to authenticated;

-- Everyone reads their own rows. Anyone who can see users reads all. Anyone who
-- can edit users changes them, but never their own.
create policy user_access_select on public.user_access
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_access('users', 'view')));
create policy user_access_insert on public.user_access
  for insert to authenticated
  with check ((select public.has_access('users', 'edit')) and user_id <> (select auth.uid()));
create policy user_access_update on public.user_access
  for update to authenticated
  using ((select public.has_access('users', 'edit')) and user_id <> (select auth.uid()))
  with check ((select public.has_access('users', 'edit')) and user_id <> (select auth.uid()));
create policy user_access_delete on public.user_access
  for delete to authenticated
  using ((select public.has_access('users', 'edit')) and user_id <> (select auth.uid()));

-- The Access section shows the role's limits, so whoever can edit users can read
-- every role's access.
drop policy role_access_select on public.role_access;
create policy role_access_select on public.role_access
  for select to authenticated
  using (
    role_id = (select public.my_role_id())
    or (select public.is_system_admin())
    or (select public.has_access('users', 'edit'))
  );

-- has_access combines the role and the user -------------------------------------

create or replace function public.has_access(p_feature text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = (select auth.uid())
      and p.status = 'active'
      and r.is_active
      and (
        not r.requires_two_factor
        or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      )
      and (
        r.is_system
        or (
          exists (
            select 1
            from public.role_access a
            where a.role_id = r.id
              and a.feature_key = p_feature
              and case p_action
                when 'view' then a.can_view
                when 'edit' then a.can_edit
                when 'delete' then a.can_delete
                else false
              end
          )
          -- A user row can only narrow the role. No row means the role's access.
          and coalesce(
            (
              select case p_action
                when 'view' then u.can_view
                when 'edit' then u.can_edit
                when 'delete' then u.can_delete
                else false
              end
              from public.user_access u
              where u.user_id = p.id and u.feature_key = p_feature
            ),
            true
          )
        )
      )
  );
$$;
