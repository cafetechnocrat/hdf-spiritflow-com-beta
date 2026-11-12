-- Assets, Liabilities and Net Valuation on the dashboard.
-- Each is a card with its own lock. A marker on the ledger groups says which
-- group is the owner's capital, so Liabilities can leave it out and Net
-- Valuation (assets minus liabilities) is what the capital is worth now.
-- The second chart now compares sales and purchases, so its lock is renamed.

update public.features set label = 'Sales And Purchases' where key = 'dash_sales_by_month';

insert into public.features
  (key, label, group_label, sort_order, offers_view, offers_edit, offers_delete) values
  ('dash_assets', 'Assets', 'Dashboard Cards', 262, true, false, false),
  ('dash_liabilities', 'Liabilities', 'Dashboard Cards', 264, true, false, false),
  ('dash_net_valuation', 'Net Valuation', 'Dashboard Cards', 266, true, false, false);

-- New cards start open for whoever has the cash and bank balances card open.
insert into public.role_access (role_id, feature_key, can_view, can_edit, can_delete)
select a.role_id, f.key, true, false, false
from public.role_access a
cross join (values ('dash_assets'), ('dash_liabilities'), ('dash_net_valuation')) as f (key)
where a.feature_key = 'dash_cash_bank_balances' and a.can_view
on conflict (role_id, feature_key) do nothing;

-- Owner's capital marker -----------------------------------------------------------

alter table public.ledger_groups add column is_equity boolean not null default false;

update public.ledger_groups set is_equity = true where name = 'Capital Account' and is_default;
update public.ledger_groups c
set is_equity = true
from public.ledger_groups p
where c.parent_id = p.id and p.is_equity;

-- A new sub-group takes its group's section, register, position and capital marker.
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
    select g.pl_section, g.register_kind, g.position_kind, g.is_equity into parent
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
      if parent.is_equity then
        new.is_equity := true;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Assets or liabilities as on a date -------------------------------------------------
-- Signed balances (debit positive) added up by the top group they sit under.
-- Assets are every group with the assets nature. Liabilities are every group with
-- the liabilities nature except the owner's capital.

create function public.dashboard_balance_totals(
  p_feature text,
  p_side text,
  p_as_on date
)
returns table (group_name text, net_text text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open(p_feature);
  if p_side not in ('assets', 'liabilities') then
    raise exception 'Choose assets or liabilities.';
  end if;
  if not (
    (p_side = 'assets' and p_feature in ('dash_assets', 'dash_net_valuation'))
    or (p_side = 'liabilities' and p_feature in ('dash_liabilities', 'dash_net_valuation'))
  ) then
    raise exception 'That card does not show this total.';
  end if;
  return query
    with recursive tree(id, top_name, nature, equity) as (
      select g.id, g.name, g.nature, g.is_equity
      from public.ledger_groups g
      where g.parent_id is null
      union all
      select c.id, t.top_name, c.nature, c.is_equity
      from public.ledger_groups c
      join tree t on c.parent_id = t.id
    )
    select
      t.top_name,
      sum(n.net_text::numeric)::text
    from public.ledgers l
    join tree t on t.id = l.group_id
    join public.report_ledger_nets(p_feature, null, p_as_on, true) n on n.ledger_id = l.id
    where (p_side = 'assets' and t.nature = 'assets')
       or (p_side = 'liabilities' and t.nature = 'liabilities' and not t.equity)
    group by t.top_name
    having sum(n.net_text::numeric) <> 0
    order by t.top_name;
end;
$$;

revoke all on function public.dashboard_balance_totals(text, text, date) from public, anon;
grant execute on function public.dashboard_balance_totals(text, text, date) to authenticated;

-- report_ledger_nets accepts any report or dashboard feature, so the new cards pass.
