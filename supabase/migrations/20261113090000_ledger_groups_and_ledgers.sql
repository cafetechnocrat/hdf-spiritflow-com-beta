-- Phase 2: ledger groups and ledgers for the Day Book.
-- Groups are data, not code. The 28 Tally default groups are seeded once below.
-- After that the app reads every group, its parent and its nature from here.
-- Ledgers are never seeded. The Chief Accountant creates them.

create type public.account_nature as enum ('assets', 'liabilities', 'income', 'expenses');
create type public.balance_side as enum ('dr', 'cr');

-- Tables --------------------------------------------------------------------

create table public.ledger_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 100),
  -- Restrict stops a group with sub-groups being deleted.
  parent_id uuid references public.ledger_groups (id) on delete restrict,
  nature public.account_nature not null,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index ledger_groups_name_key on public.ledger_groups (lower(btrim(name)));
create index ledger_groups_parent_idx on public.ledger_groups (parent_id);

create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 100),
  alias text check (alias is null or (length(btrim(alias)) > 0 and length(alias) <= 100)),
  -- Restrict stops a group that holds ledgers being deleted.
  group_id uuid not null references public.ledger_groups (id) on delete restrict,
  -- Balance as on the day the books begin. Assets and liabilities only.
  opening_amount numeric(14, 2) not null default 0 check (opening_amount >= 0),
  opening_side public.balance_side not null default 'dr',
  note text check (note is null or length(note) <= 500),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index ledgers_name_key on public.ledgers (lower(btrim(name)));
create index ledgers_group_idx on public.ledgers (group_id);

-- Starting set: the Tally default groups -------------------------------------
-- Inserted before the rule triggers exist, as system structure.

insert into public.ledger_groups (name, nature, is_default, sort_order) values
  ('Current Assets', 'assets', true, 10),
  ('Fixed Assets', 'assets', true, 20),
  ('Investments', 'assets', true, 30),
  ('Misc. Expenses (Asset)', 'assets', true, 40),
  ('Capital Account', 'liabilities', true, 50),
  ('Current Liabilities', 'liabilities', true, 60),
  ('Loans (Liability)', 'liabilities', true, 70),
  ('Suspense Account', 'liabilities', true, 80),
  ('Branch / Divisions', 'liabilities', true, 90),
  ('Sales Accounts', 'income', true, 100),
  ('Direct Incomes', 'income', true, 110),
  ('Indirect Incomes', 'income', true, 120),
  ('Purchase Accounts', 'expenses', true, 130),
  ('Direct Expenses', 'expenses', true, 140),
  ('Indirect Expenses', 'expenses', true, 150);

insert into public.ledger_groups (name, parent_id, nature, is_default, sort_order)
select v.name, p.id, p.nature, true, v.sort_order
from (values
  ('Reserves And Surplus', 'Capital Account', 10),
  ('Bank Accounts', 'Current Assets', 10),
  ('Cash-in-Hand', 'Current Assets', 20),
  ('Deposits (Asset)', 'Current Assets', 30),
  ('Loans And Advances (Asset)', 'Current Assets', 40),
  ('Stock-in-Hand', 'Current Assets', 50),
  ('Sundry Debtors', 'Current Assets', 60),
  ('Duties And Taxes', 'Current Liabilities', 10),
  ('Provisions', 'Current Liabilities', 20),
  ('Sundry Creditors', 'Current Liabilities', 30),
  ('Bank OD Account', 'Loans (Liability)', 10),
  ('Secured Loans', 'Loans (Liability)', 20),
  ('Unsecured Loans', 'Loans (Liability)', 30)
) as v (name, parent_name, sort_order)
join public.ledger_groups p on p.name = v.parent_name;

-- Rules ---------------------------------------------------------------------
-- The database holds these rules too, not only the app.

create function public.check_ledger_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
  walker uuid;
begin
  if tg_op = 'UPDATE' then
    if new.is_default is distinct from old.is_default then
      raise exception 'A group cannot change between default and custom.';
    end if;
    if new.nature is distinct from old.nature then
      raise exception 'The nature of a group cannot be changed.';
    end if;
    if old.is_default and new.parent_id is distinct from old.parent_id then
      raise exception 'A default group keeps its place.';
    end if;
  end if;

  if new.parent_id is null then
    if not new.is_default then
      raise exception 'A new group must sit under another group.';
    end if;
    return new;
  end if;

  select g.nature, g.status into parent
  from public.ledger_groups g where g.id = new.parent_id;
  if not found then
    raise exception 'Choose the group this one sits under.';
  end if;
  if parent.nature <> new.nature then
    raise exception 'A sub-group must have the same nature as its group.';
  end if;
  if new.status = 'active' and parent.status <> 'active'
     and (tg_op = 'INSERT'
          or new.parent_id is distinct from old.parent_id
          or new.status is distinct from old.status) then
    raise exception 'Choose an active group. The group above is inactive.';
  end if;

  -- A group cannot sit under itself or under one of its own sub-groups.
  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
    walker := new.parent_id;
    while walker is not null loop
      if walker = new.id then
        raise exception 'A group cannot sit under itself or its own sub-group.';
      end if;
      select g.parent_id into walker from public.ledger_groups g where g.id = walker;
    end loop;
  end if;

  return new;
end;
$$;

create trigger ledger_groups_check
  before insert or update on public.ledger_groups
  for each row execute function public.check_ledger_group();

create function public.check_ledger_group_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'inactive' and old.status = 'active' then
    if exists (
      select 1 from public.ledgers l where l.group_id = new.id and l.status = 'active'
    ) then
      raise exception 'This group still has active ledgers. Make them inactive first.';
    end if;
    if exists (
      select 1 from public.ledger_groups g where g.parent_id = new.id and g.status = 'active'
    ) then
      raise exception 'This group still has active sub-groups. Make them inactive first.';
    end if;
  end if;
  return new;
end;
$$;

create trigger ledger_groups_check_deactivation
  before update on public.ledger_groups
  for each row execute function public.check_ledger_group_deactivation();

create function public.block_default_group_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_default then
    raise exception 'A default group cannot be deleted.';
  end if;
  return old;
end;
$$;

create trigger ledger_groups_no_default_delete
  before delete on public.ledger_groups
  for each row execute function public.block_default_group_delete();

create function public.check_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grp record;
begin
  select g.nature, g.status into grp from public.ledger_groups g where g.id = new.group_id;
  if not found then
    raise exception 'Choose a group.';
  end if;
  if new.status = 'active' and grp.status <> 'active' then
    raise exception 'Choose an active group. This group is inactive.';
  end if;
  if grp.nature in ('income', 'expenses') and new.opening_amount <> 0 then
    raise exception 'Income and expense ledgers have no opening balance.';
  end if;
  return new;
end;
$$;

create trigger ledgers_check
  before insert or update on public.ledgers
  for each row execute function public.check_ledger();

-- Bookkeeping and audit -----------------------------------------------------

create trigger ledger_groups_set_updated before update on public.ledger_groups
  for each row execute function public.set_updated_fields();
create trigger ledgers_set_updated before update on public.ledgers
  for each row execute function public.set_updated_fields();

create trigger ledger_groups_audit
  after insert or update or delete on public.ledger_groups
  for each row execute function public.write_audit_row();
create trigger ledgers_audit
  after insert or update or delete on public.ledgers
  for each row execute function public.write_audit_row();

-- Row Level Security --------------------------------------------------------

alter table public.ledger_groups enable row level security;
alter table public.ledgers enable row level security;

revoke all on public.ledger_groups from anon, authenticated;
revoke all on public.ledgers from anon, authenticated;

grant select, insert, update, delete on public.ledger_groups to authenticated;
grant select, insert, update, delete on public.ledgers to authenticated;

-- MD, Chief Accountant and Accounts Staff read them. The Night Accountant gets
-- the ledger list later, with the entry screens.
create policy ledger_groups_select on public.ledger_groups
  for select to authenticated
  using ((select public.current_user_role()) in ('md', 'chief_accountant', 'accounts_staff'));
create policy ledgers_select on public.ledgers
  for select to authenticated
  using ((select public.current_user_role()) in ('md', 'chief_accountant', 'accounts_staff'));

-- Only the Chief Accountant changes them. Only an inactive record can be
-- deleted, and a default group can never be deleted.
create policy ledger_groups_insert on public.ledger_groups
  for insert to authenticated
  with check ((select public.current_user_role()) = 'chief_accountant' and not is_default);
create policy ledger_groups_update on public.ledger_groups
  for update to authenticated
  using ((select public.current_user_role()) = 'chief_accountant')
  with check ((select public.current_user_role()) = 'chief_accountant');
create policy ledger_groups_delete on public.ledger_groups
  for delete to authenticated
  using (
    (select public.current_user_role()) = 'chief_accountant'
    and status = 'inactive' and not is_default
  );

create policy ledgers_insert on public.ledgers
  for insert to authenticated
  with check ((select public.current_user_role()) = 'chief_accountant');
create policy ledgers_update on public.ledgers
  for update to authenticated
  using ((select public.current_user_role()) = 'chief_accountant')
  with check ((select public.current_user_role()) = 'chief_accountant');
create policy ledgers_delete on public.ledgers
  for delete to authenticated
  using ((select public.current_user_role()) = 'chief_accountant' and status = 'inactive');
