-- Phase 2: Day Book reports.
-- Every figure comes from these views and functions, so every report shows the
-- same numbers. Amounts come out as text so no floating point touches money.
-- Group headings, group order and which groups count as cash or bank come from
-- the ledger groups. The hotel name comes from a settings row.

-- Group flags -----------------------------------------------------------------

create type public.pl_section as enum ('trading', 'profit_loss');

alter table public.ledger_groups
  add column pl_section public.pl_section,
  add column is_cash_bank boolean not null default false;

-- Starting values for the default groups. Sub-groups follow their group.
update public.ledger_groups
set pl_section = 'trading'
where name in ('Sales Accounts', 'Direct Incomes', 'Purchase Accounts', 'Direct Expenses')
  and is_default;

update public.ledger_groups
set pl_section = 'profit_loss'
where name in ('Indirect Incomes', 'Indirect Expenses')
  and is_default;

update public.ledger_groups
set is_cash_bank = true
where name in ('Cash-in-Hand', 'Bank Accounts')
  and is_default;

-- A new sub-group takes its group's section and cash or bank flag.
create function public.inherit_group_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select g.pl_section, g.is_cash_bank into parent
    from public.ledger_groups g where g.id = new.parent_id;
    if found then
      if new.pl_section is null then
        new.pl_section := parent.pl_section;
      end if;
      if parent.is_cash_bank and tg_op = 'INSERT' then
        new.is_cash_bank := true;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger ledger_groups_inherit_flags
  before insert on public.ledger_groups
  for each row execute function public.inherit_group_flags();

-- Only an assets group can count as cash or bank.
create or replace function public.check_ledger_group()
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

  if new.is_cash_bank and new.nature <> 'assets' then
    raise exception 'Only an assets group can count as cash or bank.';
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

-- Settings ---------------------------------------------------------------------

create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{1,60}$'),
  value text not null check (length(value) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (key, value) values ('hotel_name', 'Hotel Diamond Fort');

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select, update on public.app_settings to authenticated;

create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));
create policy app_settings_update on public.app_settings
  for update to authenticated
  using ((select public.current_user_role()) = 'system_admin')
  with check ((select public.current_user_role()) = 'system_admin');

create trigger app_settings_set_updated before update on public.app_settings
  for each row execute function public.set_updated_fields();

-- Day Book rows ----------------------------------------------------------------
-- One row per voucher row, with the voucher details beside it.

create view public.day_book_rows with (security_invoker = true) as
select
  s.id as voucher_id,
  s.voucher_date,
  s.voucher_type_id,
  s.type_name,
  s.reference_no,
  s.reference,
  s.narration,
  s.status,
  s.created_at,
  e.line_no,
  e.debit_ledger_id,
  dl.name as debit_name,
  e.credit_ledger_id,
  cl.name as credit_name,
  e.amount::text as amount_text
from public.voucher_summaries s
join public.voucher_entries e on e.voucher_id = s.id
join public.ledgers dl on dl.id = e.debit_ledger_id
join public.ledgers cl on cl.id = e.credit_ledger_id;

revoke all on public.day_book_rows from anon, authenticated;
grant select on public.day_book_rows to authenticated;

-- Ledger nets ------------------------------------------------------------------
-- Debit minus credit for every ledger, as signed text. Positive is debit.
-- p_from and p_to can be null for no limit. The opening balance counts only
-- when p_with_opening is true. Void vouchers are left out.

create function public.report_ledger_nets(
  p_from date,
  p_to date,
  p_with_opening boolean
)
returns table (ledger_id uuid, net_text text)
language sql
stable
set search_path = ''
as $$
  select
    l.id,
    (
      case
        when p_with_opening and l.opening_side = 'dr' then l.opening_amount
        when p_with_opening then -l.opening_amount
        else 0
      end
      + coalesce((
          select sum(e.amount)
          from public.voucher_entries e
          join public.vouchers v on v.id = e.voucher_id
          where e.debit_ledger_id = l.id
            and v.status = 'posted'
            and (p_from is null or v.voucher_date >= p_from)
            and (p_to is null or v.voucher_date <= p_to)
        ), 0)
      - coalesce((
          select sum(e.amount)
          from public.voucher_entries e
          join public.vouchers v on v.id = e.voucher_id
          where e.credit_ledger_id = l.id
            and v.status = 'posted'
            and (p_from is null or v.voucher_date >= p_from)
            and (p_to is null or v.voucher_date <= p_to)
        ), 0)
    )::text
  from public.ledgers l;
$$;

revoke all on function public.report_ledger_nets(date, date, boolean) from public, anon;
grant execute on function public.report_ledger_nets(date, date, boolean) to authenticated;

-- Ledger statement rows --------------------------------------------------------
-- Each entry that touches the ledger, with the other ledger of the row.

create function public.report_ledger_statement(
  p_ledger uuid,
  p_from date,
  p_to date
)
returns table (
  voucher_id uuid,
  voucher_date date,
  type_name text,
  reference_no text,
  narration text,
  other_name text,
  debit_text text,
  credit_text text
)
language sql
stable
set search_path = ''
as $$
  select
    x.voucher_id, x.voucher_date, x.type_name, x.reference_no, x.narration,
    x.other_name, x.debit_text, x.credit_text
  from (
    select
      s.id as voucher_id, s.voucher_date, s.type_name, s.reference_no, s.narration,
      s.created_at, e.line_no,
      cl.name as other_name,
      e.amount::text as debit_text,
      null::text as credit_text
    from public.voucher_entries e
    join public.voucher_summaries s on s.id = e.voucher_id
    join public.ledgers cl on cl.id = e.credit_ledger_id
    where e.debit_ledger_id = p_ledger
      and s.status = 'posted'
      and s.voucher_date between p_from and p_to
    union all
    select
      s.id, s.voucher_date, s.type_name, s.reference_no, s.narration,
      s.created_at, e.line_no,
      dl.name,
      null::text,
      e.amount::text
    from public.voucher_entries e
    join public.voucher_summaries s on s.id = e.voucher_id
    join public.ledgers dl on dl.id = e.debit_ledger_id
    where e.credit_ledger_id = p_ledger
      and s.status = 'posted'
      and s.voucher_date between p_from and p_to
  ) x
  order by x.voucher_date, x.created_at, x.line_no;
$$;

revoke all on function public.report_ledger_statement(uuid, date, date) from public, anon;
grant execute on function public.report_ledger_statement(uuid, date, date) to authenticated;

-- Cash and bank book -----------------------------------------------------------
-- Receipts (debits) and payments (credits) per day for the given ledgers.

create function public.report_cash_bank_days(
  p_from date,
  p_to date,
  p_ledger_ids uuid[]
)
returns table (day date, receipts_text text, payments_text text)
language sql
stable
set search_path = ''
as $$
  with moves as (
    select v.voucher_date as day, e.amount as receipts, 0::numeric as payments
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    where e.debit_ledger_id = any (p_ledger_ids)
      and v.status = 'posted'
      and v.voucher_date between p_from and p_to
    union all
    select v.voucher_date, 0::numeric, e.amount
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    where e.credit_ledger_id = any (p_ledger_ids)
      and v.status = 'posted'
      and v.voucher_date between p_from and p_to
  )
  select m.day, sum(m.receipts)::text, sum(m.payments)::text
  from moves m
  group by m.day
  order by m.day;
$$;

revoke all on function public.report_cash_bank_days(date, date, uuid[]) from public, anon;
grant execute on function public.report_cash_bank_days(date, date, uuid[]) to authenticated;
