-- Roles and access are data the System Admin controls.
-- Roles are rows, each role has View, Edit and Delete permissions per feature,
-- and two-factor and "active" are switches on the role. Every policy and every
-- database function asks one helper, has_access(), so the menu, the screens and
-- the database rules always agree. The fixed role list and the old
-- current_user_role() are removed.

create type public.sign_in_method as enum ('email', 'pin');

-- Roles ---------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 60),
  -- The one built-in role. It has every right, cannot be renamed, switched off
  -- or deleted. Only its two-factor setting can change.
  is_system boolean not null default false,
  is_active boolean not null default false,
  requires_two_factor boolean not null default false,
  sign_in_method public.sign_in_method not null default 'email',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index roles_name_key on public.roles (lower(btrim(name)));
create unique index roles_one_system_key on public.roles (is_system) where is_system;

-- The features access can be given to, with the actions each one offers.
create table public.features (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  label text not null,
  group_label text not null,
  sort_order integer not null default 0,
  offers_view boolean not null default true,
  offers_edit boolean not null default false,
  offers_delete boolean not null default false
);

create table public.role_access (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  feature_key text not null references public.features (key) on delete restrict,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index role_access_key on public.role_access (role_id, feature_key);

-- Starting roles and features ----------------------------------------------------

insert into public.roles (name, is_system, is_active, requires_two_factor, sign_in_method, sort_order) values
  ('System Admin', true, true, true, 'email', 10),
  ('Managing Director', false, false, false, 'email', 20),
  ('Chief Accountant', false, false, false, 'email', 30),
  ('Accounting Staff', false, false, false, 'email', 40),
  ('Billing / Cashier', false, false, false, 'pin', 50),
  ('Warehouse Manager', false, false, false, 'email', 60),
  ('Bar Captain', false, false, false, 'email', 70),
  ('Restaurant Captain', false, false, false, 'email', 80);

insert into public.features
  (key, label, group_label, sort_order, offers_view, offers_edit, offers_delete) values
  ('dashboard', 'Dashboard', 'General', 10, true, false, false),
  ('users', 'Users', 'Administration', 20, true, true, true),
  ('structure', 'Stock Points, Outlets And Counters', 'Inventory', 30, true, true, true),
  ('ledgers', 'Ledger Groups And Ledgers', 'Accounts', 40, true, true, true),
  ('transactions', 'Transactions', 'Accounts', 50, true, true, true),
  ('voucher_changes', 'Edit Or Void Posted Vouchers', 'Accounts', 60, false, true, false),
  ('reports', 'Reports', 'Accounts', 70, true, false, false);

-- Profiles point at a role ----------------------------------------------------

alter table public.profiles add column role_id uuid references public.roles (id) on delete restrict;

update public.profiles p
set role_id = r.id
from public.roles r
where r.name = case p.role::text
  when 'system_admin' then 'System Admin'
  when 'md' then 'Managing Director'
  when 'chief_accountant' then 'Chief Accountant'
  when 'accounts_staff' then 'Accounting Staff'
  when 'cashier' then 'Billing / Cashier'
end;

-- Fails here, safely, if a profile has a role that has no match above.
alter table public.profiles alter column role_id set not null;

-- Helpers ---------------------------------------------------------------------
-- Each one reads the profile and role from the database, never from user
-- metadata. A role that is not active, or that needs two-factor before the
-- session has passed it (aal2), matches nothing.

create function public.my_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.role_id from public.profiles p where p.id = (select auth.uid());
$$;

create function public.is_active_user()
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
  );
$$;

create function public.is_system_admin()
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
      and r.is_system
      and (
        not r.requires_two_factor
        or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      )
  );
$$;

-- Does the signed in user have this action ('view', 'edit' or 'delete') on this
-- feature? The System Admin role always does.
create function public.has_access(p_feature text, p_action text)
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
        or exists (
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
      )
  );
$$;

revoke all on function public.my_role_id() from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_system_admin() from public, anon;
revoke all on function public.has_access(text, text) from public, anon;
grant execute on function public.my_role_id() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.has_access(text, text) to authenticated;

-- Rules -----------------------------------------------------------------------

create function public.check_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'The System Admin role cannot be deleted.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.is_system then
    if new.is_system is distinct from old.is_system
       or new.name is distinct from old.name
       or new.is_active is distinct from old.is_active
       or new.sign_in_method is distinct from old.sign_in_method then
      raise exception 'The System Admin role is built in. Only its two-factor setting can change.';
    end if;
  end if;
  if tg_op = 'UPDATE' and not old.is_system and new.is_system then
    raise exception 'A role cannot be made a System Admin role.';
  end if;
  return new;
end;
$$;

create trigger roles_check
  before insert or update or delete on public.roles
  for each row execute function public.check_role();

create function public.check_role_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  r record;
begin
  select ro.is_system into r from public.roles ro where ro.id = new.role_id;
  if r.is_system then
    raise exception 'The System Admin role always has full access. It has no access rows.';
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
  return new;
end;
$$;

create trigger role_access_check
  before insert or update on public.role_access
  for each row execute function public.check_role_access();

-- Bookkeeping and audit -----------------------------------------------------

create trigger roles_set_updated before update on public.roles
  for each row execute function public.set_updated_fields();
create trigger role_access_set_updated before update on public.role_access
  for each row execute function public.set_updated_fields();

create trigger roles_audit
  after insert or update or delete on public.roles
  for each row execute function public.write_audit_row();
create trigger role_access_audit
  after insert or update or delete on public.role_access
  for each row execute function public.write_audit_row();

-- Row Level Security for the new tables -----------------------------------------

alter table public.roles enable row level security;
alter table public.features enable row level security;
alter table public.role_access enable row level security;

revoke all on public.roles from anon, authenticated;
revoke all on public.features from anon, authenticated;
revoke all on public.role_access from anon, authenticated;

grant select, insert, update, delete on public.roles to authenticated;
grant select on public.features to authenticated;
grant select, insert, update, delete on public.role_access to authenticated;

-- Everyone reads their own role. Anyone who can see users reads all roles, so
-- the users list can show each person's role. The System Admin changes them.
create policy roles_select on public.roles
  for select to authenticated
  using (
    id = (select public.my_role_id())
    or (select public.is_system_admin())
    or (select public.has_access('users', 'view'))
  );
create policy roles_insert on public.roles
  for insert to authenticated
  with check ((select public.is_system_admin()));
create policy roles_update on public.roles
  for update to authenticated
  using ((select public.is_system_admin()))
  with check ((select public.is_system_admin()));
create policy roles_delete on public.roles
  for delete to authenticated
  using ((select public.is_system_admin()));

create policy features_select on public.features
  for select to authenticated
  using (true);

create policy role_access_select on public.role_access
  for select to authenticated
  using (role_id = (select public.my_role_id()) or (select public.is_system_admin()));
create policy role_access_insert on public.role_access
  for insert to authenticated
  with check ((select public.is_system_admin()));
create policy role_access_update on public.role_access
  for update to authenticated
  using ((select public.is_system_admin()))
  with check ((select public.is_system_admin()));
create policy role_access_delete on public.role_access
  for delete to authenticated
  using ((select public.is_system_admin()));

-- Every existing policy now asks has_access() --------------------------------------

-- Profiles (Users).
drop policy profiles_select on public.profiles;
drop policy profiles_insert on public.profiles;
drop policy profiles_update on public.profiles;
drop policy profiles_delete on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.has_access('users', 'view')));
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.has_access('users', 'edit')));
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select public.has_access('users', 'edit')))
  with check ((select public.has_access('users', 'edit')));
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (
    (select public.has_access('users', 'delete'))
    and status = 'inactive'
    and id <> (select auth.uid())
  );

-- Audit log: System Admin only until its screen is built.
drop policy audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using ((select public.is_system_admin()));

-- Stock points, outlets and counters.
drop policy stock_points_select on public.stock_points;
drop policy stock_points_insert on public.stock_points;
drop policy stock_points_update on public.stock_points;
drop policy stock_points_delete on public.stock_points;
drop policy outlets_select on public.outlets;
drop policy outlets_insert on public.outlets;
drop policy outlets_update on public.outlets;
drop policy outlets_delete on public.outlets;
drop policy counters_select on public.counters;
drop policy counters_insert on public.counters;
drop policy counters_update on public.counters;
drop policy counters_delete on public.counters;

create policy stock_points_select on public.stock_points
  for select to authenticated using ((select public.has_access('structure', 'view')));
create policy stock_points_insert on public.stock_points
  for insert to authenticated with check ((select public.has_access('structure', 'edit')));
create policy stock_points_update on public.stock_points
  for update to authenticated
  using ((select public.has_access('structure', 'edit')))
  with check ((select public.has_access('structure', 'edit')));
create policy stock_points_delete on public.stock_points
  for delete to authenticated
  using ((select public.has_access('structure', 'delete')) and status = 'inactive');

create policy outlets_select on public.outlets
  for select to authenticated using ((select public.has_access('structure', 'view')));
create policy outlets_insert on public.outlets
  for insert to authenticated with check ((select public.has_access('structure', 'edit')));
create policy outlets_update on public.outlets
  for update to authenticated
  using ((select public.has_access('structure', 'edit')))
  with check ((select public.has_access('structure', 'edit')));
create policy outlets_delete on public.outlets
  for delete to authenticated
  using ((select public.has_access('structure', 'delete')) and status = 'inactive');

create policy counters_select on public.counters
  for select to authenticated using ((select public.has_access('structure', 'view')));
create policy counters_insert on public.counters
  for insert to authenticated with check ((select public.has_access('structure', 'edit')));
create policy counters_update on public.counters
  for update to authenticated
  using ((select public.has_access('structure', 'edit')))
  with check ((select public.has_access('structure', 'edit')));
create policy counters_delete on public.counters
  for delete to authenticated
  using ((select public.has_access('structure', 'delete')) and status = 'inactive');

-- Ledger groups and ledgers. Anyone who can see transactions or reports can
-- read them, because vouchers and reports show ledger names.
drop policy ledger_groups_select on public.ledger_groups;
drop policy ledger_groups_insert on public.ledger_groups;
drop policy ledger_groups_update on public.ledger_groups;
drop policy ledger_groups_delete on public.ledger_groups;
drop policy ledgers_select on public.ledgers;
drop policy ledgers_insert on public.ledgers;
drop policy ledgers_update on public.ledgers;
drop policy ledgers_delete on public.ledgers;

create policy ledger_groups_select on public.ledger_groups
  for select to authenticated
  using (
    (select public.has_access('ledgers', 'view'))
    or (select public.has_access('transactions', 'view'))
    or (select public.has_access('reports', 'view'))
  );
create policy ledger_groups_insert on public.ledger_groups
  for insert to authenticated
  with check ((select public.has_access('ledgers', 'edit')) and not is_default);
create policy ledger_groups_update on public.ledger_groups
  for update to authenticated
  using ((select public.has_access('ledgers', 'edit')))
  with check ((select public.has_access('ledgers', 'edit')));
create policy ledger_groups_delete on public.ledger_groups
  for delete to authenticated
  using (
    (select public.has_access('ledgers', 'delete'))
    and status = 'inactive' and not is_default
  );

create policy ledgers_select on public.ledgers
  for select to authenticated
  using (
    (select public.has_access('ledgers', 'view'))
    or (select public.has_access('transactions', 'view'))
    or (select public.has_access('reports', 'view'))
  );
create policy ledgers_insert on public.ledgers
  for insert to authenticated
  with check ((select public.has_access('ledgers', 'edit')));
create policy ledgers_update on public.ledgers
  for update to authenticated
  using ((select public.has_access('ledgers', 'edit')))
  with check ((select public.has_access('ledgers', 'edit')));
create policy ledgers_delete on public.ledgers
  for delete to authenticated
  using ((select public.has_access('ledgers', 'delete')) and status = 'inactive');

-- Vouchers: readable by anyone who sees transactions or reports.
drop policy voucher_types_select on public.voucher_types;
drop policy voucher_type_rules_select on public.voucher_type_rules;
drop policy vouchers_select on public.vouchers;
drop policy voucher_entries_select on public.voucher_entries;

create policy voucher_types_select on public.voucher_types
  for select to authenticated
  using (
    (select public.has_access('transactions', 'view'))
    or (select public.has_access('reports', 'view'))
  );
create policy voucher_type_rules_select on public.voucher_type_rules
  for select to authenticated
  using (
    (select public.has_access('transactions', 'view'))
    or (select public.has_access('reports', 'view'))
  );
create policy vouchers_select on public.vouchers
  for select to authenticated
  using (
    (select public.has_access('transactions', 'view'))
    or (select public.has_access('reports', 'view'))
  );
create policy voucher_entries_select on public.voucher_entries
  for select to authenticated
  using (
    (select public.has_access('transactions', 'view'))
    or (select public.has_access('reports', 'view'))
  );

-- Each user's own preferences, for any active user.
drop policy user_preferences_select on public.user_preferences;
drop policy user_preferences_insert on public.user_preferences;
drop policy user_preferences_update on public.user_preferences;

create policy user_preferences_select on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy user_preferences_insert on public.user_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy user_preferences_update on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_user()))
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));

-- Settings.
drop policy app_settings_select on public.app_settings;
drop policy app_settings_update on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select public.is_active_user()));
create policy app_settings_update on public.app_settings
  for update to authenticated
  using ((select public.is_system_admin()))
  with check ((select public.is_system_admin()));

-- Voucher functions ask has_access() too -----------------------------------------

create or replace function public.save_voucher(
  p_id uuid,
  p_type uuid,
  p_date date,
  p_reference text,
  p_narration text,
  p_reason text,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_fy integer;
  v_number integer;
  v_old record;
begin
  if p_date is null then
    raise exception 'Choose the transaction date.';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 then
    raise exception 'Add at least one row.';
  end if;

  v_fy := case
    when extract(month from p_date) >= 4 then extract(year from p_date)::integer
    else extract(year from p_date)::integer - 1
  end;

  if p_id is null then
    if not public.has_access('transactions', 'edit') then
      raise exception 'You do not have permission to enter vouchers.' using errcode = '42501';
    end if;
    if p_type is null then
      raise exception 'Choose the voucher type.';
    end if;
    insert into public.voucher_counters as c (voucher_type_id, fy_start_year, last_number)
    values (p_type, v_fy, 1)
    on conflict (voucher_type_id, fy_start_year)
    do update set last_number = c.last_number + 1
    returning c.last_number into v_number;

    insert into public.vouchers (
      voucher_type_id, voucher_date, fy_start_year, number, reference, narration, created_by
    ) values (
      p_type, p_date, v_fy, v_number, nullif(btrim(p_reference), ''),
      nullif(btrim(p_narration), ''), auth.uid()
    ) returning id into v_id;
  else
    if not public.has_access('voucher_changes', 'edit') then
      raise exception 'You do not have permission to edit a posted voucher.'
        using errcode = '42501';
    end if;
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Enter the reason for the edit.';
    end if;
    select v.status, v.fy_start_year into v_old
    from public.vouchers v where v.id = p_id for update;
    if not found then
      raise exception 'That voucher was not found.';
    end if;
    if v_old.status <> 'posted' then
      raise exception 'A void voucher cannot be edited.';
    end if;
    if v_old.fy_start_year <> v_fy then
      raise exception 'The date must stay in the same financial year (April to March). Void this voucher and enter a new one instead.';
    end if;

    update public.vouchers
    set voucher_date = p_date,
        reference = nullif(btrim(p_reference), ''),
        narration = nullif(btrim(p_narration), ''),
        edit_reason = btrim(p_reason)
    where id = p_id;
    delete from public.voucher_entries where voucher_id = p_id;
    v_id := p_id;
  end if;

  insert into public.voucher_entries (
    voucher_id, line_no, debit_ledger_id, credit_ledger_id, amount, created_by
  )
  select v_id,
         t.ordinality::integer,
         (t.entry ->> 'debit')::uuid,
         (t.entry ->> 'credit')::uuid,
         (t.entry ->> 'amount')::numeric,
         auth.uid()
  from jsonb_array_elements(p_entries) with ordinality as t (entry, ordinality);

  return v_id;
end;
$$;

create or replace function public.void_voucher(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_access('voucher_changes', 'edit') then
    raise exception 'You do not have permission to void a voucher.' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Enter the reason for voiding.';
  end if;
  update public.vouchers
  set status = 'void',
      void_reason = btrim(p_reason),
      voided_at = now(),
      voided_by = auth.uid()
  where id = p_id and status = 'posted';
  if not found then
    raise exception 'That voucher was not found, or it is already void.';
  end if;
end;
$$;

create or replace function public.delete_voucher(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_access('transactions', 'delete') then
    raise exception 'You do not have permission to delete a voucher.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.vouchers where id = p_id) then
    raise exception 'That voucher was not found.';
  end if;
  perform set_config('app.allow_voucher_delete', 'on', true);
  delete from public.voucher_entries where voucher_id = p_id;
  delete from public.vouchers where id = p_id;
  perform set_config('app.allow_voucher_delete', 'off', true);
end;
$$;

-- The old role list and helper are gone ---------------------------------------------

drop function public.current_user_role();
alter table public.profiles drop column role;
drop type public.user_role;
