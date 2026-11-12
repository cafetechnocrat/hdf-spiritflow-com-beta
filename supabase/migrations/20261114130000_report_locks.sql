-- Reports and dashboard locks.
-- Every report and every dashboard card is its own feature with one action,
-- View. View off means locked. They replace the single Reports feature.
-- Reports and dashboard cards now read through functions that check the lock for
-- that one report or card, so a locked person cannot get the figures by calling
-- the database around the screen. Direct reads of vouchers and ledgers need the
-- Transactions or Ledger Groups And Ledgers feature.

-- The lock features ------------------------------------------------------------

insert into public.features
  (key, label, group_label, sort_order, offers_view, offers_edit, offers_delete) values
  ('report_day_book', 'Day Book', 'Reports', 100, true, false, false),
  ('report_ledger_statement', 'Ledger Statement', 'Reports', 110, true, false, false),
  ('report_sales_register', 'Sales Register', 'Reports', 120, true, false, false),
  ('report_purchase_register', 'Purchase Register', 'Reports', 130, true, false, false),
  ('report_trial_balance', 'Trial Balance', 'Reports', 140, true, false, false),
  ('report_profit_loss', 'Profit And Loss', 'Reports', 150, true, false, false),
  ('report_balance_sheet', 'Balance Sheet', 'Reports', 160, true, false, false),
  ('dash_sales', 'Sales', 'Dashboard Cards', 200, true, false, false),
  ('dash_purchases', 'Purchases', 'Dashboard Cards', 210, true, false, false),
  ('dash_gross_profit', 'Gross Profit', 'Dashboard Cards', 220, true, false, false),
  ('dash_cash_bank', 'Cash And Bank', 'Dashboard Cards', 230, true, false, false),
  ('dash_income_expenses', 'Income And Expenses', 'Dashboard Cards', 240, true, false, false),
  ('dash_sales_by_month', 'Sales By Month', 'Dashboard Cards', 250, true, false, false),
  ('dash_cash_bank_balances', 'Cash And Bank Balances', 'Dashboard Cards', 260, true, false, false),
  ('dash_receivables', 'Receivables', 'Dashboard Cards', 270, true, false, false),
  ('dash_payables', 'Payables', 'Dashboard Cards', 280, true, false, false),
  ('dash_latest_vouchers', 'Latest Vouchers', 'Dashboard Cards', 290, true, false, false),
  ('dash_books_check', 'Books Check', 'Dashboard Cards', 300, true, false, false);

-- Existing access carries over: whoever could view Reports keeps every report and
-- card open. Whoever had Reports locked for them stays locked on all of them.
insert into public.role_access (role_id, feature_key, can_view, can_edit, can_delete)
select a.role_id, f.key, true, false, false
from public.role_access a
cross join public.features f
where a.feature_key = 'reports' and a.can_view
  and f.group_label in ('Reports', 'Dashboard Cards')
on conflict (role_id, feature_key) do nothing;

insert into public.user_access (user_id, feature_key, can_view, can_edit, can_delete)
select u.user_id, f.key, false, false, false
from public.user_access u
cross join public.features f
where u.feature_key = 'reports' and not u.can_view
  and f.group_label in ('Reports', 'Dashboard Cards')
on conflict (user_id, feature_key) do nothing;

delete from public.user_access where feature_key = 'reports';
delete from public.role_access where feature_key = 'reports';
delete from public.features where key = 'reports';

-- The lock check ----------------------------------------------------------------

create function public.require_lock_open(p_feature text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_feature is null or not exists (
    select 1 from public.features f
    where f.key = p_feature and f.group_label in ('Reports', 'Dashboard Cards')
  ) then
    raise exception 'That report or card does not exist.';
  end if;
  if not public.has_access(p_feature, 'view') then
    raise exception 'This report is locked for you.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_lock_open(text) from public, anon, authenticated;

-- Old report and dashboard functions are replaced -----------------------------------

drop function if exists public.dashboard_positions(date);
drop function if exists public.dashboard_register_monthly(public.register_kind, date, date);
drop function if exists public.dashboard_monthly(date, date);
drop function if exists public.report_ledger_nets(date, date, boolean);

-- Chart of accounts for reports: groups, ledgers and voucher types --------------------

create function public.report_chart_groups(p_feature text)
returns table (
  id uuid,
  name text,
  parent_id uuid,
  nature public.account_nature,
  sort_order integer,
  pl_section public.pl_section,
  register_kind public.register_kind
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  return query
    select g.id, g.name, g.parent_id, g.nature, g.sort_order, g.pl_section, g.register_kind
    from public.ledger_groups g;
end;
$$;

create function public.report_chart_ledgers(p_feature text)
returns table (id uuid, name text, group_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  return query select l.id, l.name, l.group_id from public.ledgers l order by l.name;
end;
$$;

create function public.report_voucher_types(p_feature text)
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  return query
    select t.id, t.name from public.voucher_types t order by t.sort_order, t.name;
end;
$$;

-- Ledger nets: debit minus credit per ledger, as signed text -------------------------

create function public.report_ledger_nets(
  p_feature text,
  p_from date,
  p_to date,
  p_with_opening boolean
)
returns table (ledger_id uuid, net_text text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  return query
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
end;
$$;

-- Ledger statement ----------------------------------------------------------------

create or replace function public.report_ledger_statement(
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open('report_ledger_statement');
  return query
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
end;
$$;

-- Registers -----------------------------------------------------------------------

create or replace function public.report_register(
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(
    case p_kind when 'sales' then 'report_sales_register' else 'report_purchase_register' end
  );
  return query
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
        and l.group_id in (select sg.id from scope_groups sg)
    ),
    legs as (
      select e.voucher_id, e.debit_ledger_id as ledger_id,
             case when p_kind = 'sales' then -e.amount else e.amount end as net
      from public.voucher_entries e
      where e.voucher_id in (select sv.voucher_id from scope_vouchers sv)
      union all
      select e.voucher_id, e.credit_ledger_id,
             case when p_kind = 'sales' then e.amount else -e.amount end
      from public.voucher_entries e
      where e.voucher_id in (select sv.voucher_id from scope_vouchers sv)
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
end;
$$;

-- Day Book --------------------------------------------------------------------------

create function public.report_day_book(
  p_from date,
  p_to date,
  p_type uuid,
  p_ledger uuid,
  p_show_void boolean,
  p_limit integer
)
returns table (
  voucher_id uuid,
  voucher_date date,
  type_name text,
  reference_no text,
  reference text,
  narration text,
  status public.voucher_status,
  debit_name text,
  credit_name text,
  amount_text text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open('report_day_book');
  return query
    select r.voucher_id, r.voucher_date, r.type_name, r.reference_no, r.reference,
           r.narration, r.status, r.debit_name, r.credit_name, r.amount_text
    from public.day_book_rows r
    where r.voucher_date between p_from and p_to
      and (p_show_void or r.status = 'posted')
      and (p_type is null or r.voucher_type_id = p_type)
      and (p_ledger is null or r.debit_ledger_id = p_ledger or r.credit_ledger_id = p_ledger)
    order by r.voucher_date, r.created_at, r.line_no
    limit p_limit;
end;
$$;

create function public.report_day_book_void_count(p_from date, p_to date, p_type uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.require_lock_open('report_day_book');
  select count(*)::integer into n
  from public.vouchers v
  where v.status = 'void'
    and v.voucher_date between p_from and p_to
    and (p_type is null or v.voucher_type_id = p_type);
  return n;
end;
$$;

-- Dashboard cards -----------------------------------------------------------------------

-- Income and expenses by month. With p_trading_only the figures cover only the
-- trading groups, which gives Gross Profit.
create function public.dashboard_monthly(
  p_feature text,
  p_from date,
  p_to date,
  p_trading_only boolean
)
returns table (month_start date, income_text text, expense_text text)
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
      date_trunc('month', x.voucher_date)::date,
      coalesce(sum(case when g.nature = 'income' then x.net end), 0)::text,
      coalesce(sum(case when g.nature = 'expenses' then -x.net end), 0)::text
    from legs x
    join public.ledger_groups g on g.id = x.group_id
    where not p_trading_only or g.pl_section = 'trading'
    group by 1
    order by 1;
end;
$$;

create function public.dashboard_register_monthly(
  p_feature text,
  p_kind public.register_kind,
  p_from date,
  p_to date
)
returns table (month_start date, ledger_id uuid, ledger_name text, amount_text text)
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
      select v.voucher_date, l.id as ledger_id, l.name as ledger_name,
             case when p_kind = 'sales' then -e.amount else e.amount end as net
      from public.voucher_entries e
      join public.vouchers v on v.id = e.voucher_id
      join public.ledgers l on l.id = e.debit_ledger_id
      where v.status = 'posted' and v.voucher_date between p_from and p_to
        and l.group_id in (select sg.id from scope_groups sg)
      union all
      select v.voucher_date, l.id, l.name,
             case when p_kind = 'sales' then e.amount else -e.amount end
      from public.voucher_entries e
      join public.vouchers v on v.id = e.voucher_id
      join public.ledgers l on l.id = e.credit_ledger_id
      where v.status = 'posted' and v.voucher_date between p_from and p_to
        and l.group_id in (select sg.id from scope_groups sg)
    )
    select date_trunc('month', x.voucher_date)::date, x.ledger_id, x.ledger_name, sum(x.net)::text
    from legs x
    group by 1, x.ledger_id, x.ledger_name
    having sum(x.net) <> 0
    order by 1, x.ledger_name;
end;
$$;

-- Cash and bank, receivables or payables as on a date. The card that asks must
-- be the one that shows that position.
create function public.dashboard_positions(
  p_feature text,
  p_kind public.position_kind,
  p_as_on date
)
returns table (ledger_id uuid, ledger_name text, net_text text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  if not (
    (p_kind = 'cash_bank' and p_feature in ('dash_cash_bank', 'dash_cash_bank_balances'))
    or (p_kind = 'receivable' and p_feature = 'dash_receivables')
    or (p_kind = 'payable' and p_feature = 'dash_payables')
  ) then
    raise exception 'That card does not show this position.';
  end if;
  return query
    with recursive scope_groups(id) as (
      select g.id from public.ledger_groups g where g.position_kind = p_kind
      union
      select c.id
      from public.ledger_groups c
      join scope_groups s on c.parent_id = s.id
    )
    select l.id, l.name, n.net_text
    from public.ledgers l
    join scope_groups s on s.id = l.group_id
    join public.report_ledger_nets(p_feature, null, p_as_on, true) n on n.ledger_id = l.id
    where n.net_text <> '0.00'
    order by l.name;
end;
$$;

create function public.dashboard_latest_vouchers(p_limit integer)
returns table (
  id uuid,
  type_name text,
  reference_no text,
  voucher_date date,
  debit_names text,
  credit_names text,
  total_text text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open('dash_latest_vouchers');
  return query
    select s.id, s.type_name, s.reference_no, s.voucher_date, s.debit_names, s.credit_names, s.total_text
    from public.voucher_summaries s
    where s.status = 'posted'
    order by s.voucher_date desc, s.created_at desc
    limit least(greatest(p_limit, 1), 20);
end;
$$;

create function public.dashboard_books_check(
  p_today date,
  p_day_start timestamptz,
  p_month_start timestamptz
)
returns table (
  difference_text text,
  entered_today integer,
  latest_at timestamptz,
  void_month integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debit numeric;
  v_credit numeric;
begin
  perform public.require_lock_open('dash_books_check');

  select coalesce(sum(n.net_text::numeric) filter (where n.net_text::numeric > 0), 0),
         coalesce(-sum(n.net_text::numeric) filter (where n.net_text::numeric < 0), 0)
  into v_debit, v_credit
  from public.report_ledger_nets('dash_books_check', null, p_today, true) n;

  return query
    select
      abs(v_debit - v_credit)::text,
      (select count(*)::integer from public.vouchers v
        where v.status = 'posted' and v.created_at >= p_day_start),
      (select max(v.created_at) from public.vouchers v
        where v.status = 'posted' and v.created_at >= p_day_start),
      (select count(*)::integer from public.vouchers v
        where v.status = 'void' and v.voided_at >= p_month_start);
end;
$$;

-- Grants ---------------------------------------------------------------------------------

revoke all on function public.report_chart_groups(text) from public, anon;
revoke all on function public.report_chart_ledgers(text) from public, anon;
revoke all on function public.report_voucher_types(text) from public, anon;
revoke all on function public.report_ledger_nets(text, date, date, boolean) from public, anon;
revoke all on function public.report_day_book(date, date, uuid, uuid, boolean, integer) from public, anon;
revoke all on function public.report_day_book_void_count(date, date, uuid) from public, anon;
revoke all on function public.dashboard_monthly(text, date, date, boolean) from public, anon;
revoke all on function public.dashboard_register_monthly(text, public.register_kind, date, date) from public, anon;
revoke all on function public.dashboard_positions(text, public.position_kind, date) from public, anon;
revoke all on function public.dashboard_latest_vouchers(integer) from public, anon;
revoke all on function public.dashboard_books_check(date, timestamptz, timestamptz) from public, anon;

grant execute on function public.report_chart_groups(text) to authenticated;
grant execute on function public.report_chart_ledgers(text) to authenticated;
grant execute on function public.report_voucher_types(text) to authenticated;
grant execute on function public.report_ledger_nets(text, date, date, boolean) to authenticated;
grant execute on function public.report_day_book(date, date, uuid, uuid, boolean, integer) to authenticated;
grant execute on function public.report_day_book_void_count(date, date, uuid) to authenticated;
grant execute on function public.dashboard_monthly(text, date, date, boolean) to authenticated;
grant execute on function public.dashboard_register_monthly(text, public.register_kind, date, date) to authenticated;
grant execute on function public.dashboard_positions(text, public.position_kind, date) to authenticated;
grant execute on function public.dashboard_latest_vouchers(integer) to authenticated;
grant execute on function public.dashboard_books_check(date, timestamptz, timestamptz) to authenticated;

-- The raw Day Book view is only for the function above.
revoke select on public.day_book_rows from authenticated;

-- Tables are readable by their own features, not by report access ----------------------------

drop policy ledger_groups_select on public.ledger_groups;
create policy ledger_groups_select on public.ledger_groups
  for select to authenticated
  using (
    (select public.has_access('ledgers', 'view'))
    or (select public.has_access('transactions', 'view'))
  );

drop policy ledgers_select on public.ledgers;
create policy ledgers_select on public.ledgers
  for select to authenticated
  using (
    (select public.has_access('ledgers', 'view'))
    or (select public.has_access('transactions', 'view'))
  );

drop policy voucher_types_select on public.voucher_types;
create policy voucher_types_select on public.voucher_types
  for select to authenticated
  using ((select public.has_access('transactions', 'view')));

drop policy voucher_type_rules_select on public.voucher_type_rules;
create policy voucher_type_rules_select on public.voucher_type_rules
  for select to authenticated
  using ((select public.has_access('transactions', 'view')));

drop policy vouchers_select on public.vouchers;
create policy vouchers_select on public.vouchers
  for select to authenticated
  using ((select public.has_access('transactions', 'view')));

drop policy voucher_entries_select on public.voucher_entries;
create policy voucher_entries_select on public.voucher_entries
  for select to authenticated
  using ((select public.has_access('transactions', 'view')));
