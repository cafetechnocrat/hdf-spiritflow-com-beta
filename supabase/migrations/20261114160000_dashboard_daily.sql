-- Dashboard charts by day. The Day, Week, Month and Year views are all added up
-- from these daily figures. Each one asks for the lock of the card that shows it.

-- Income and expenses by day (all income and expense ledgers).
create function public.dashboard_daily(
  p_feature text,
  p_from date,
  p_to date
)
returns table (day date, income_text text, expense_text text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  return query
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
      x.voucher_date,
      coalesce(sum(case when g.nature = 'income' then x.net end), 0)::text,
      coalesce(sum(case when g.nature = 'expenses' then -x.net end), 0)::text
    from legs x
    join public.ledger_groups g on g.id = x.group_id
    group by x.voucher_date
    order by x.voucher_date;
end;
$$;

-- Sales or purchases by day, from the ledgers under the groups marked for that
-- register. Sales are credit minus debit. Purchases are debit minus credit.
create function public.dashboard_register_daily(
  p_feature text,
  p_kind public.register_kind,
  p_from date,
  p_to date
)
returns table (day date, amount_text text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  return query
    with recursive scope_groups as (
      select g.id from public.ledger_groups g where g.register_kind = p_kind
      union
      select c.id
      from public.ledger_groups c
      join scope_groups s on c.parent_id = s.id
    ),
    legs as (
      select v.voucher_date,
             case when p_kind = 'sales' then -e.amount else e.amount end as net
      from public.voucher_entries e
      join public.vouchers v on v.id = e.voucher_id
      join public.ledgers l on l.id = e.debit_ledger_id
      where v.status = 'posted' and v.voucher_date between p_from and p_to
        and l.group_id in (select sg.id from scope_groups sg)
      union all
      select v.voucher_date,
             case when p_kind = 'sales' then e.amount else -e.amount end
      from public.voucher_entries e
      join public.vouchers v on v.id = e.voucher_id
      join public.ledgers l on l.id = e.credit_ledger_id
      where v.status = 'posted' and v.voucher_date between p_from and p_to
        and l.group_id in (select sg.id from scope_groups sg)
    )
    select x.voucher_date, sum(x.net)::text
    from legs x
    group by x.voucher_date
    having sum(x.net) <> 0
    order by x.voucher_date;
end;
$$;

revoke all on function public.dashboard_daily(text, date, date) from public, anon;
revoke all on function public.dashboard_register_daily(text, public.register_kind, date, date)
  from public, anon;
grant execute on function public.dashboard_daily(text, date, date) to authenticated;
grant execute on function public.dashboard_register_daily(text, public.register_kind, date, date)
  to authenticated;
