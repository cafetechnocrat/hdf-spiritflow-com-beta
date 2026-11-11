-- Phase 2: transaction entry (vouchers).
-- Every voucher is a list of rows. Each row holds a debit ledger, a credit
-- ledger and an amount, so a voucher always balances. Voucher types, their
-- labels, numbering prefixes and which ledger groups each side may pick from
-- are rows here. Nothing about them is fixed in the app.

create type public.voucher_status as enum ('posted', 'void');

-- Voucher types -------------------------------------------------------------

create table public.voucher_types (
  id uuid primary key default gen_random_uuid(),
  -- Prefix used in the voucher reference, for example PAY.
  code text not null check (code ~ '^[A-Z]{2,6}$'),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 60),
  debit_label text not null check (length(btrim(debit_label)) > 0),
  credit_label text not null check (length(btrim(credit_label)) > 0),
  sort_order integer not null default 0,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index voucher_types_code_key on public.voucher_types (code);
create unique index voucher_types_name_key on public.voucher_types (lower(btrim(name)));

-- Which ledger groups (and everything under them) a side of a type may pick
-- from. A side with no rows may pick any ledger.
create table public.voucher_type_rules (
  id uuid primary key default gen_random_uuid(),
  voucher_type_id uuid not null references public.voucher_types (id) on delete restrict,
  side public.balance_side not null,
  group_id uuid not null references public.ledger_groups (id) on delete restrict
);
create unique index voucher_type_rules_key
  on public.voucher_type_rules (voucher_type_id, side, group_id);

-- Last number used per type per financial year. Only the save function touches it.
create table public.voucher_counters (
  voucher_type_id uuid not null references public.voucher_types (id) on delete restrict,
  fy_start_year integer not null,
  last_number integer not null check (last_number > 0),
  primary key (voucher_type_id, fy_start_year)
);

-- Vouchers and their rows ---------------------------------------------------

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_type_id uuid not null references public.voucher_types (id) on delete restrict,
  voucher_date date not null,
  -- Financial year starts in April. 2026 means April 2026 to March 2027.
  fy_start_year integer not null,
  number integer not null check (number > 0),
  reference text check (reference is null or length(reference) <= 100),
  narration text check (narration is null or length(narration) <= 500),
  status public.voucher_status not null default 'posted',
  edit_reason text check (edit_reason is null or length(edit_reason) <= 300),
  void_reason text check (void_reason is null or length(void_reason) <= 300),
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check ((status = 'void') = (voided_at is not null and void_reason is not null))
);
create unique index vouchers_number_key
  on public.vouchers (voucher_type_id, fy_start_year, number);
create index vouchers_date_idx on public.vouchers (voucher_date desc);

create table public.voucher_entries (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers (id) on delete restrict,
  line_no integer not null check (line_no > 0),
  debit_ledger_id uuid not null references public.ledgers (id) on delete restrict,
  credit_ledger_id uuid not null references public.ledgers (id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (debit_ledger_id <> credit_ledger_id)
);
create unique index voucher_entries_line_key on public.voucher_entries (voucher_id, line_no);
create index voucher_entries_debit_idx on public.voucher_entries (debit_ledger_id);
create index voucher_entries_credit_idx on public.voucher_entries (credit_ledger_id);

-- The date new vouchers start on, per user -----------------------------------

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  transaction_date date,
  updated_at timestamptz not null default now()
);

-- Starting voucher types and rules -------------------------------------------

insert into public.voucher_types (code, name, debit_label, credit_label, sort_order) values
  ('PAY', 'Payment', 'Paid To (Debit)', 'Paid From (Credit)', 10),
  ('RCT', 'Receipt', 'Received In (Debit)', 'Received From (Credit)', 20),
  ('CON', 'Contra', 'To (Debit)', 'From (Credit)', 30),
  ('JOU', 'Journal', 'Debit', 'Credit', 40),
  ('SAL', 'Sales', 'Received In Or Due From (Debit)', 'Sales Or Tax (Credit)', 50),
  ('PUR', 'Purchase', 'Purchase, Expense Or Tax (Debit)', 'Paid From Or Due To (Credit)', 60);

insert into public.voucher_type_rules (voucher_type_id, side, group_id)
select t.id, r.side::public.balance_side, g.id
from (values
  ('Payment', 'cr', 'Cash-in-Hand'),
  ('Payment', 'cr', 'Bank Accounts'),
  ('Receipt', 'dr', 'Cash-in-Hand'),
  ('Receipt', 'dr', 'Bank Accounts'),
  ('Contra', 'dr', 'Cash-in-Hand'),
  ('Contra', 'dr', 'Bank Accounts'),
  ('Contra', 'cr', 'Cash-in-Hand'),
  ('Contra', 'cr', 'Bank Accounts'),
  ('Sales', 'dr', 'Cash-in-Hand'),
  ('Sales', 'dr', 'Bank Accounts'),
  ('Sales', 'dr', 'Sundry Debtors'),
  ('Sales', 'cr', 'Sales Accounts'),
  ('Sales', 'cr', 'Duties And Taxes'),
  ('Purchase', 'dr', 'Purchase Accounts'),
  ('Purchase', 'dr', 'Direct Expenses'),
  ('Purchase', 'dr', 'Indirect Expenses'),
  ('Purchase', 'dr', 'Duties And Taxes'),
  ('Purchase', 'cr', 'Cash-in-Hand'),
  ('Purchase', 'cr', 'Bank Accounts'),
  ('Purchase', 'cr', 'Sundry Creditors')
) as r (type_name, side, group_name)
join public.voucher_types t on t.name = r.type_name
join public.ledger_groups g on g.name = r.group_name;

-- Rules ---------------------------------------------------------------------

-- Whether a ledger sits under a group that a side of a voucher type allows.
create function public.ledger_fits_voucher_side(
  p_type uuid,
  p_side public.balance_side,
  p_ledger uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.voucher_type_rules r
      where r.voucher_type_id = p_type and r.side = p_side
    ) then true
    else exists (
      with recursive allowed as (
        select r.group_id as id
        from public.voucher_type_rules r
        where r.voucher_type_id = p_type and r.side = p_side
        union
        select g.id
        from public.ledger_groups g
        join allowed a on g.parent_id = a.id
      )
      select 1
      from public.ledgers l
      join allowed a on a.id = l.group_id
      where l.id = p_ledger
    )
  end;
$$;

revoke all on function public.ledger_fits_voucher_side(uuid, public.balance_side, uuid)
  from public, anon;
grant execute on function public.ledger_fits_voucher_side(uuid, public.balance_side, uuid)
  to authenticated;

create function public.check_voucher_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vch record;
  led record;
begin
  select v.voucher_type_id, v.status into vch
  from public.vouchers v where v.id = new.voucher_id;
  if not found or vch.status <> 'posted' then
    raise exception 'Rows can only be added to a posted voucher.';
  end if;

  select l.name, l.status into led from public.ledgers l where l.id = new.debit_ledger_id;
  if led.status <> 'active' then
    raise exception 'The ledger % is inactive.', led.name;
  end if;
  if not public.ledger_fits_voucher_side(vch.voucher_type_id, 'dr', new.debit_ledger_id) then
    raise exception 'The ledger % cannot be used on the debit side of this voucher type.', led.name;
  end if;

  select l.name, l.status into led from public.ledgers l where l.id = new.credit_ledger_id;
  if led.status <> 'active' then
    raise exception 'The ledger % is inactive.', led.name;
  end if;
  if not public.ledger_fits_voucher_side(vch.voucher_type_id, 'cr', new.credit_ledger_id) then
    raise exception 'The ledger % cannot be used on the credit side of this voucher type.', led.name;
  end if;

  return new;
end;
$$;

create trigger voucher_entries_check
  before insert on public.voucher_entries
  for each row execute function public.check_voucher_entry();

create function public.block_voucher_entry_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Voucher rows are replaced when a voucher is edited, never updated.';
end;
$$;

create trigger voucher_entries_no_update
  before update on public.voucher_entries
  for each row execute function public.block_voucher_entry_update();

create function public.check_voucher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.voucher_types t
      where t.id = new.voucher_type_id and t.status = 'active'
    ) then
      raise exception 'This voucher type is not active.';
    end if;
  else
    if old.status = 'void' then
      raise exception 'A void voucher cannot be changed.';
    end if;
    if new.voucher_type_id <> old.voucher_type_id
       or new.fy_start_year <> old.fy_start_year
       or new.number <> old.number then
      raise exception 'The type, financial year and number of a voucher cannot change.';
    end if;
  end if;
  return new;
end;
$$;

create trigger vouchers_check
  before insert or update on public.vouchers
  for each row execute function public.check_voucher();

-- Vouchers are never deleted.
create function public.block_voucher_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Vouchers are never deleted. Void it instead.';
end;
$$;

create trigger vouchers_no_delete
  before delete on public.vouchers
  for each row execute function public.block_voucher_delete();

-- Bookkeeping and audit -----------------------------------------------------

create trigger voucher_types_set_updated before update on public.voucher_types
  for each row execute function public.set_updated_fields();
create trigger vouchers_set_updated before update on public.vouchers
  for each row execute function public.set_updated_fields();

create trigger voucher_types_audit
  after insert or update or delete on public.voucher_types
  for each row execute function public.write_audit_row();
create trigger vouchers_audit
  after insert or update or delete on public.vouchers
  for each row execute function public.write_audit_row();
create trigger voucher_entries_audit
  after insert or update or delete on public.voucher_entries
  for each row execute function public.write_audit_row();

-- Saving and voiding --------------------------------------------------------
-- These run as the table owner so the number and the rows are written in one
-- step. They check the role themselves.

create function public.save_voucher(
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
  if not (public.current_user_role() in ('chief_accountant', 'accounts_staff', 'system_admin')) then
    raise exception 'You do not have permission to enter vouchers.' using errcode = '42501';
  end if;
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
    if public.current_user_role() <> 'chief_accountant' then
      raise exception 'Only the Chief Accountant can edit a posted voucher.' using errcode = '42501';
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

create function public.void_voucher(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() <> 'chief_accountant' then
    raise exception 'Only the Chief Accountant can void a voucher.' using errcode = '42501';
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

revoke all on function public.save_voucher(uuid, uuid, date, text, text, text, jsonb)
  from public, anon;
revoke all on function public.void_voucher(uuid, text) from public, anon;
grant execute on function public.save_voucher(uuid, uuid, date, text, text, text, jsonb)
  to authenticated;
grant execute on function public.void_voucher(uuid, text) to authenticated;

-- Views for the screen -------------------------------------------------------
-- Amounts come out as text so no floating point touches the money.

create view public.voucher_summaries with (security_invoker = true) as
select
  v.id,
  v.voucher_type_id,
  t.code as type_code,
  t.name as type_name,
  v.voucher_date,
  v.fy_start_year,
  v.number,
  t.code || '/' || v.fy_start_year || '-'
    || lpad(((v.fy_start_year + 1) % 100)::text, 2, '0')
    || '/' || lpad(v.number::text, 4, '0') as reference_no,
  v.reference,
  v.narration,
  v.status,
  v.edit_reason,
  v.void_reason,
  v.created_at,
  coalesce(s.total, 0)::text as total_text,
  s.debit_names,
  s.credit_names
from public.vouchers v
join public.voucher_types t on t.id = v.voucher_type_id
left join lateral (
  select
    sum(e.amount) as total,
    string_agg(distinct dl.name, ', ') as debit_names,
    string_agg(distinct cl.name, ', ') as credit_names
  from public.voucher_entries e
  join public.ledgers dl on dl.id = e.debit_ledger_id
  join public.ledgers cl on cl.id = e.credit_ledger_id
  where e.voucher_id = v.id
) s on true;

create view public.voucher_entry_details with (security_invoker = true) as
select
  e.id,
  e.voucher_id,
  e.line_no,
  e.debit_ledger_id,
  dl.name as debit_name,
  e.credit_ledger_id,
  cl.name as credit_name,
  e.amount::text as amount_text
from public.voucher_entries e
join public.ledgers dl on dl.id = e.debit_ledger_id
join public.ledgers cl on cl.id = e.credit_ledger_id;

-- Row Level Security --------------------------------------------------------

alter table public.voucher_types enable row level security;
alter table public.voucher_type_rules enable row level security;
alter table public.voucher_counters enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_entries enable row level security;
alter table public.user_preferences enable row level security;

revoke all on public.voucher_types from anon, authenticated;
revoke all on public.voucher_type_rules from anon, authenticated;
revoke all on public.voucher_counters from anon, authenticated;
revoke all on public.vouchers from anon, authenticated;
revoke all on public.voucher_entries from anon, authenticated;
revoke all on public.user_preferences from anon, authenticated;
revoke all on public.voucher_summaries from anon, authenticated;
revoke all on public.voucher_entry_details from anon, authenticated;

grant select on public.voucher_types to authenticated;
grant select on public.voucher_type_rules to authenticated;
grant select on public.vouchers to authenticated;
grant select on public.voucher_entries to authenticated;
grant select on public.voucher_summaries to authenticated;
grant select on public.voucher_entry_details to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

-- Read-only for the roles that see the accounts. Writes go through the
-- functions above, never straight to the tables.
create policy voucher_types_select on public.voucher_types
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));
create policy voucher_type_rules_select on public.voucher_type_rules
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));
create policy vouchers_select on public.vouchers
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));
create policy voucher_entries_select on public.voucher_entries
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));

-- Each user keeps their own transaction date. Only roles that enter vouchers.
create policy user_preferences_select on public.user_preferences
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('chief_accountant', 'accounts_staff', 'system_admin')
  );
create policy user_preferences_insert on public.user_preferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('chief_accountant', 'accounts_staff', 'system_admin')
  );
create policy user_preferences_update on public.user_preferences
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('chief_accountant', 'accounts_staff', 'system_admin')
  )
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('chief_accountant', 'accounts_staff', 'system_admin')
  );
