-- Dashboard figures.
-- A marker on each ledger group says which dashboard position it feeds: cash and
-- bank, what customers owe (receivable) or what is owed to vendors (payable).
-- Sub-groups follow their group. The functions below read through Row Level
-- Security, so a user sees only what their access allows. Amounts come out as
-- text so no floating point touches money.

create type public.position_kind as enum ('cash_bank', 'receivable', 'payable');

alter table public.ledger_groups add column position_kind public.position_kind;

update public.ledger_groups set position_kind = 'cash_bank'
where name in ('Cash-in-Hand', 'Bank Accounts') and is_default;
update public.ledger_groups set position_kind = 'receivable'
where name = 'Sundry Debtors' and is_default;
update public.ledger_groups set position_kind = 'payable'
where name = 'Sundry Creditors' and is_default;

-- A new sub-group takes its group's section, register and position.
create or replace function public.inherit_group_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select g.pl_section, g.register_kind, g.position_kind into parent
    from public.ledger_groups g where g.id = new.parent_id;
    if found then
      if new.pl_section is null then
        new.pl_section := parent.pl_section;
      end if;
      if new.register_kind is null then
        new.register_kind := parent.register_kind;
      end if;
      if new.position_kind is null then
        new.position_kind := parent.position_kind;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Income and expenses by month ------------------------------------------------
-- Income is credit minus debit on income ledgers. Expenses are debit minus
-- credit on expense ledgers. Void vouchers are left out.

create function public.dashboard_monthly(p_from date, p_to date)
returns table (month_start date, income_text text, expense_text text)
language sql
stable
set search_path = ''
as $$
  with legs as (
    select v.voucher_date, l.group_id, -e.amount as net
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    join public.ledgers l on l.id = e.debit_ledger_id
    where v.status = 'posted' and v.voucher_date between p_from and p_to
    union all
    select v.voucher_date, l.group_id, e.amount
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    join public.ledgers l on l.id = e.credit_ledger_id
    where v.status = 'posted' and v.voucher_date between p_from and p_to
  )
  select
    date_trunc('month', x.voucher_date)::date,
    coalesce(sum(case when g.nature = 'income' then x.net end), 0)::text,
    coalesce(sum(case when g.nature = 'expenses' then -x.net end), 0)::text
  from legs x
  join public.ledger_groups g on g.id = x.group_id
  group by 1
  order by 1;
$$;

-- Sales or purchases by month and ledger ---------------------------------------
-- Only the ledgers under the groups marked for that register. Sales are credit
-- minus debit. Purchases are debit minus credit.

create function public.dashboard_register_monthly(
  p_kind public.register_kind,
  p_from date,
  p_to date
)
returns table (month_start date, ledger_id uuid, ledger_name text, amount_text text)
language sql
stable
set search_path = ''
as $$
  with recursive scope_groups as (
    select g.id from public.ledger_groups g where g.register_kind = p_kind
    union
    select c.id
    from public.ledger_groups c
    join scope_groups s on c.parent_id = s.id
  ),
  legs as (
    select v.voucher_date, l.id as ledger_id, l.name as ledger_name,
           case when p_kind = 'sales' then -e.amount else e.amount end as net
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    join public.ledgers l on l.id = e.debit_ledger_id
    where v.status = 'posted' and v.voucher_date between p_from and p_to
      and l.group_id in (select id from scope_groups)
    union all
    select v.voucher_date, l.id, l.name,
           case when p_kind = 'sales' then e.amount else -e.amount end
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    join public.ledgers l on l.id = e.credit_ledger_id
    where v.status = 'posted' and v.voucher_date between p_from and p_to
      and l.group_id in (select id from scope_groups)
  )
  select date_trunc('month', x.voucher_date)::date, x.ledger_id, x.ledger_name, sum(x.net)::text
  from legs x
  group by 1, x.ledger_id, x.ledger_name
  having sum(x.net) <> 0
  order by 1, x.ledger_name;
$$;

-- Cash and bank, receivables and payables --------------------------------------
-- The signed balance (debit positive) of every ledger under a position group as
-- on a date, with the position it belongs to.

create function public.dashboard_positions(p_as_on date)
returns table (kind text, ledger_id uuid, ledger_name text, net_text text)
language sql
stable
set search_path = ''
as $$
  with recursive scope_groups(id, kind) as (
    select g.id, g.position_kind from public.ledger_groups g where g.position_kind is not null
    union
    select c.id, s.kind
    from public.ledger_groups c
    join scope_groups s on c.parent_id = s.id
  )
  select s.kind::text, l.id, l.name, n.net_text
  from public.ledgers l
  join scope_groups s on s.id = l.group_id
  join public.report_ledger_nets(null, p_as_on, true) n on n.ledger_id = l.id
  where n.net_text <> '0.00'
  order by s.kind, l.name;
$$;

revoke all on function public.dashboard_monthly(date, date) from public, anon;
revoke all on function public.dashboard_register_monthly(public.register_kind, date, date) from public, anon;
revoke all on function public.dashboard_positions(date) from public, anon;
grant execute on function public.dashboard_monthly(date, date) to authenticated;
grant execute on function public.dashboard_register_monthly(public.register_kind, date, date) to authenticated;
grant execute on function public.dashboard_positions(date) to authenticated;
