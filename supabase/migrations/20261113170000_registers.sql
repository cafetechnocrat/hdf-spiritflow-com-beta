-- Sales Register and Purchase Register.
-- A marker on each ledger group says which register it feeds. Sub-groups follow
-- their group. A voucher belongs to a register when any of its rows touches a
-- ledger under a marked group.

create type public.register_kind as enum ('sales', 'purchase');

alter table public.ledger_groups add column register_kind public.register_kind;

update public.ledger_groups
set register_kind = 'sales'
where name = 'Sales Accounts' and is_default;

update public.ledger_groups
set register_kind = 'purchase'
where name = 'Purchase Accounts' and is_default;

-- A new sub-group takes its group's section and register.
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
    select g.pl_section, g.register_kind into parent
    from public.ledger_groups g where g.id = new.parent_id;
    if found then
      if new.pl_section is null then
        new.pl_section := parent.pl_section;
      end if;
      if new.register_kind is null then
        new.register_kind := parent.register_kind;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- The register ledgers of each voucher in the range, as signed text. The net is
-- credit minus debit for sales and debit minus credit for purchases, so the
-- register side is positive. Void vouchers are left out.
create function public.report_register(
  p_kind public.register_kind,
  p_from date,
  p_to date
)
returns table (
  voucher_id uuid,
  voucher_date date,
  type_name text,
  reference_no text,
  ledger_id uuid,
  ledger_name text,
  net_text text
)
language sql
stable
set search_path = ''
as $$
  with recursive scope_groups as (
    select g.id
    from public.ledger_groups g
    where g.register_kind = p_kind
    union
    select c.id
    from public.ledger_groups c
    join scope_groups s on c.parent_id = s.id
  ),
  scope_vouchers as (
    select distinct e.voucher_id
    from public.voucher_entries e
    join public.vouchers v on v.id = e.voucher_id
    join public.ledgers l on l.id = e.debit_ledger_id or l.id = e.credit_ledger_id
    where v.status = 'posted'
      and v.voucher_date between p_from and p_to
      and l.group_id in (select id from scope_groups)
  ),
  legs as (
    select e.voucher_id, e.debit_ledger_id as ledger_id,
           case when p_kind = 'sales' then -e.amount else e.amount end as net
    from public.voucher_entries e
    where e.voucher_id in (select voucher_id from scope_vouchers)
    union all
    select e.voucher_id, e.credit_ledger_id,
           case when p_kind = 'sales' then e.amount else -e.amount end
    from public.voucher_entries e
    where e.voucher_id in (select voucher_id from scope_vouchers)
  )
  select
    s.id, s.voucher_date, s.type_name, s.reference_no,
    l.id, l.name,
    sum(x.net)::text
  from legs x
  join public.voucher_summaries s on s.id = x.voucher_id
  join public.ledgers l on l.id = x.ledger_id
  group by s.id, s.voucher_date, s.type_name, s.reference_no, s.created_at, l.id, l.name
  having sum(x.net) <> 0
  order by s.voucher_date, s.created_at, l.name;
$$;

revoke all on function public.report_register(public.register_kind, date, date)
  from public, anon;
grant execute on function public.report_register(public.register_kind, date, date)
  to authenticated;
