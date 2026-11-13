-- Stock Count (docs/08-Stock-Count.md).
-- Physical stock taking by stock point and date: bottles, and pegs where the stock
-- point and the item allow them. Quantities only. The one link to the accounts is
-- posting the total closing stock value to the Closing Stock screen. The counts
-- change no other figure.

-- The rights ---------------------------------------------------------------------
-- Five rights, each set on the Roles screen.

insert into public.features
  (key, label, group_label, sort_order, offers_view, offers_edit, offers_delete) values
  ('stock_count', 'Stock Count', 'Inventory Management', 70, true, true, false),
  ('stock_count_save', 'Save Stock Count', 'Inventory Management', 71, false, true, false),
  ('stock_count_export', 'Export Stock Count', 'Inventory Management', 72, false, true, false),
  ('stock_count_value', 'View Stock Value', 'Inventory Management', 73, true, false, false),
  ('stock_count_post', 'Post To Closing Stock', 'Inventory Management', 74, false, true, false);

-- Whoever can enter closing stock starts with all five. A role that can only see
-- closing stock starts with viewing the counts and their value. The F & B Manager
-- role is made on the Roles screen and given the first three.
insert into public.role_access (role_id, feature_key, can_view, can_edit, can_delete)
select
  a.role_id,
  f.key,
  f.key in ('stock_count', 'stock_count_value'),
  f.key in ('stock_count', 'stock_count_save', 'stock_count_export', 'stock_count_post')
    and a.can_edit,
  false
from public.role_access a
cross join (values
  ('stock_count'), ('stock_count_save'), ('stock_count_export'),
  ('stock_count_value'), ('stock_count_post')
) as f (key)
where a.feature_key = 'closing_stock'
  and a.can_view
  and (f.key in ('stock_count', 'stock_count_value') or a.can_edit)
on conflict (role_id, feature_key) do nothing;

-- Tables ---------------------------------------------------------------------------

create type public.stock_count_status as enum ('draft', 'complete');

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  stock_point_id uuid not null references public.stock_points (id) on delete restrict,
  stock_date date not null,
  counted_by text check (counted_by is null or length(counted_by) <= 100),
  status public.stock_count_status not null default 'draft',
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index stock_counts_key on public.stock_counts (stock_point_id, stock_date);
create index stock_counts_date_idx on public.stock_counts (stock_date);

create table public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts (id) on delete restrict,
  item_id uuid not null references public.liquor_items (id) on delete restrict,
  -- Null means not entered yet. Zero means counted and none left.
  bottles integer check (bottles is null or (bottles >= 0 and bottles <= 100000)),
  pegs numeric(6, 2) check (pegs is null or (pegs >= 0 and pegs <= 9999)),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index stock_count_lines_key on public.stock_count_lines (count_id, item_id);

create trigger stock_counts_set_updated before update on public.stock_counts
  for each row execute function public.set_updated_fields();
create trigger stock_count_lines_set_updated before update on public.stock_count_lines
  for each row execute function public.set_updated_fields();
create trigger stock_counts_audit
  after insert or update or delete on public.stock_counts
  for each row execute function public.write_audit_row();
create trigger stock_count_lines_audit
  after insert or update or delete on public.stock_count_lines
  for each row execute function public.write_audit_row();

-- Row Level Security: reading needs the Stock Count right. All writing goes
-- through the functions below, which check the right again.

alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
revoke all on public.stock_counts from anon, authenticated;
revoke all on public.stock_count_lines from anon, authenticated;
grant select on public.stock_counts to authenticated;
grant select on public.stock_count_lines to authenticated;

create policy stock_counts_select on public.stock_counts
  for select to authenticated
  using ((select public.has_access('stock_count', 'view')));
create policy stock_count_lines_select on public.stock_count_lines
  for select to authenticated
  using ((select public.has_access('stock_count', 'view')));

-- What the screen lists ---------------------------------------------------------------
-- The stock points to count and the items, read here so the screen does not depend
-- on the access to the Stock Points and Liquor Items screens.

create function public.stock_count_points()
returns table (id uuid, name text, peg_allowed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_access('stock_count', 'view') then
    raise exception 'You do not have permission to see stock counts.' using errcode = '42501';
  end if;
  return query
    select sp.id, sp.name, sp.peg_allowed
    from public.stock_points sp
    where sp.type = 'liquor' and sp.status = 'active'
    order by sp.name;
end;
$$;

create function public.stock_count_items()
returns table (
  id uuid,
  item_code text,
  item_name text,
  stock_name text,
  volume_ml integer,
  category_name text,
  peg_sale_allowed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_access('stock_count', 'view') then
    raise exception 'You do not have permission to see stock counts.' using errcode = '42501';
  end if;
  return query
    select i.id, i.item_code, i.item_name, i.stock_name, i.volume_ml, c.name, i.peg_sale_allowed
    from public.liquor_items i
    join public.liquor_categories c on c.id = i.category_id
    where i.status = 'active'
    order by c.sort_order, c.name, i.stock_name, i.volume_ml, i.item_code;
end;
$$;

-- Entering and saving a count -----------------------------------------------------------

-- Saves one item's entry. Pegs are kept only where the stock point and the item
-- both allow them. Changing a Complete count returns it to Draft until it is saved
-- again.
create function public.stock_count_set_line(
  p_point uuid,
  p_date date,
  p_item uuid,
  p_bottles integer,
  p_pegs numeric,
  p_by text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peg_point boolean;
  v_peg_item boolean;
  v_pegs numeric;
  v_count uuid;
  v_by text := nullif(btrim(p_by), '');
begin
  if not public.has_access('stock_count', 'edit') then
    raise exception 'You do not have permission to take stock.' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Choose the stock date.';
  end if;
  select sp.peg_allowed into v_peg_point from public.stock_points sp
  where sp.id = p_point and sp.type = 'liquor' and sp.status = 'active';
  if not found then
    raise exception 'That stock point cannot be counted.';
  end if;
  select i.peg_sale_allowed into v_peg_item from public.liquor_items i
  where i.id = p_item and i.status = 'active';
  if not found then
    raise exception 'That item is not an active liquor item.';
  end if;
  v_pegs := case when v_peg_point and v_peg_item then p_pegs else null end;

  insert into public.stock_counts as c (stock_point_id, stock_date, counted_by, created_by)
  values (p_point, p_date, v_by, auth.uid())
  on conflict (stock_point_id, stock_date) do update
    set status = 'draft', completed_at = null, completed_by = null,
        counted_by = coalesce(v_by, c.counted_by)
    where c.status <> 'draft' or (v_by is not null and c.counted_by is distinct from v_by)
  returning c.id into v_count;
  if v_count is null then
    select c.id into v_count from public.stock_counts c
    where c.stock_point_id = p_point and c.stock_date = p_date;
  end if;

  insert into public.stock_count_lines as l (count_id, item_id, bottles, pegs, created_by)
  values (v_count, p_item, p_bottles, v_pegs, auth.uid())
  on conflict (count_id, item_id) do update
    set bottles = excluded.bottles, pegs = excluded.pegs
    where l.bottles is distinct from excluded.bottles or l.pegs is distinct from excluded.pegs;
  return v_count;
end;
$$;

-- The Save button. Counts the items still blank. If none are, the count is Complete.
create function public.save_stock_count(p_point uuid, p_date date, p_by text)
returns table (missing integer, saved boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peg_point boolean;
  v_count uuid;
  v_missing integer;
  v_total integer;
  v_by text := nullif(btrim(p_by), '');
begin
  if not public.has_access('stock_count_save', 'edit') then
    raise exception 'You do not have permission to save a stock count.' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Choose the stock date.';
  end if;
  select sp.peg_allowed into v_peg_point from public.stock_points sp
  where sp.id = p_point and sp.type = 'liquor' and sp.status = 'active';
  if not found then
    raise exception 'That stock point cannot be counted.';
  end if;
  select c.id into v_count from public.stock_counts c
  where c.stock_point_id = p_point and c.stock_date = p_date;

  select count(*) filter (
           where l.bottles is null
              or (v_peg_point and i.peg_sale_allowed and l.pegs is null)
         ),
         count(*)
  into v_missing, v_total
  from public.liquor_items i
  left join public.stock_count_lines l on l.count_id = v_count and l.item_id = i.id
  where i.status = 'active';

  if v_missing > 0 then
    return query select v_missing, false;
    return;
  end if;
  if v_total = 0 or v_count is null then
    raise exception 'There are no items to count.';
  end if;
  update public.stock_counts c
  set status = 'complete', completed_at = now(), completed_by = auth.uid(),
      counted_by = coalesce(v_by, c.counted_by)
  where c.id = v_count;
  return query select 0, true;
end;
$$;

-- Value ----------------------------------------------------------------------------------
-- Used only inside the functions below. Each line is valued at cost: the bottles plus
-- the pegs (60 ml each) times the cost of a bottle, which is the case rate in force on
-- the stock date divided by the bottles in a case, plus the cess. Rounded to the paisa
-- for each item, as the valuation report does. Only Complete counts are valued.

create function public.stock_count_line_values(p_from date, p_to date)
returns table (
  count_id uuid,
  stock_point_id uuid,
  stock_date date,
  item_id uuid,
  bottles integer,
  pegs numeric,
  value numeric,
  priced boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.stock_point_id, c.stock_date, l.item_id, l.bottles, l.pegs,
    case when r.case_rate is null then 0::numeric else
      round(
        (coalesce(l.bottles, 0) * i.volume_ml + coalesce(l.pegs, 0) * 60)
        * (r.case_rate + r.cess_amount * i.bottles_per_case)
        / (i.volume_ml::numeric * i.bottles_per_case),
        2
      )
    end,
    r.case_rate is not null
  from public.stock_counts c
  join public.stock_count_lines l on l.count_id = c.id
  join public.liquor_items i on i.id = l.item_id
  left join lateral (
    select x.case_rate, x.cess_amount
    from public.liquor_item_rates x
    where x.item_id = i.id and x.effective_date <= c.stock_date
    order by x.effective_date desc
    limit 1
  ) r on true
  where c.status = 'complete' and c.stock_date between p_from and p_to;
$$;

revoke all on function public.stock_count_line_values(date, date) from public, anon, authenticated;

-- The counts, newest first, for the Past Counts tab. The value is filled only for a
-- person with the View Stock Value right, and only for a Complete count.
create function public.stock_count_list(
  p_from date,
  p_to date,
  p_point uuid,
  p_status public.stock_count_status
)
returns table (
  id uuid,
  stock_point_id uuid,
  point_name text,
  stock_date date,
  status public.stock_count_status,
  counted_by text,
  items_counted integer,
  items_total integer,
  bottles bigint,
  pegs numeric,
  value numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_show_value boolean;
  v_items integer;
begin
  if not public.has_access('stock_count', 'view') then
    raise exception 'You do not have permission to see stock counts.' using errcode = '42501';
  end if;
  v_show_value := public.has_access('stock_count_value', 'view');
  select count(*) into v_items from public.liquor_items i where i.status = 'active';

  return query
  with vals as (
    select v.count_id, sum(v.value) as total
    from public.stock_count_line_values(p_from, p_to) v
    where v_show_value
    group by v.count_id
  )
  select
    c.id, c.stock_point_id, sp.name, c.stock_date, c.status, c.counted_by,
    (select count(*)::integer
       from public.stock_count_lines l
       join public.liquor_items i on i.id = l.item_id
      where l.count_id = c.id and i.status = 'active' and l.bottles is not null
        and (not (sp.peg_allowed and i.peg_sale_allowed) or l.pegs is not null)),
    v_items,
    coalesce((select sum(l.bottles) from public.stock_count_lines l where l.count_id = c.id), 0),
    coalesce((select sum(l.pegs) from public.stock_count_lines l where l.count_id = c.id), 0),
    case when c.status = 'complete' then vals.total end
  from public.stock_counts c
  join public.stock_points sp on sp.id = c.stock_point_id
  left join vals on vals.count_id = c.id
  where c.stock_date between p_from and p_to
    and (p_point is null or c.stock_point_id = p_point)
    and (p_status is null or c.status = p_status)
  order by c.stock_date desc, sp.name
  limit 500;
end;
$$;

-- Stock value of one date, stock point by stock point.
create function public.stock_count_value_summary(p_date date)
returns table (stock_point_id uuid, point_name text, status text, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_access('stock_count_value', 'view') then
    raise exception 'You do not have permission to see stock value.' using errcode = '42501';
  end if;
  return query
  with vals as (
    select v.stock_point_id as sp_id, sum(v.value) as total
    from public.stock_count_line_values(p_date, p_date) v
    group by v.stock_point_id
  )
  select sp.id, sp.name,
         coalesce(c.status::text, 'none'),
         case when c.status = 'complete' then coalesce(vals.total, 0) end
  from public.stock_points sp
  left join public.stock_counts c on c.stock_point_id = sp.id and c.stock_date = p_date
  left join vals on vals.sp_id = sp.id
  where sp.type = 'liquor' and sp.status = 'active'
  order by sp.name;
end;
$$;

-- Posting to Closing Stock ----------------------------------------------------------------

create function public.stock_count_post_preview(p_account uuid, p_date date)
returns table (
  total numeric,
  points_total integer,
  points_complete integer,
  unpriced_lines integer,
  has_existing boolean,
  existing_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_access('stock_count_post', 'edit') and public.has_access('stock_count_value', 'view')) then
    raise exception 'You do not have permission to post closing stock.' using errcode = '42501';
  end if;
  return query
  select
    coalesce((select sum(v.value) from public.stock_count_line_values(p_date, p_date) v), 0),
    (select count(*)::integer from public.stock_points sp where sp.type = 'liquor' and sp.status = 'active'),
    (select count(*)::integer
       from public.stock_counts c
       join public.stock_points sp on sp.id = c.stock_point_id
      where c.stock_date = p_date and c.status = 'complete'
        and sp.type = 'liquor' and sp.status = 'active'),
    (select count(*)::integer from public.stock_count_line_values(p_date, p_date) v
      where not v.priced and (coalesce(v.bottles, 0) > 0 or coalesce(v.pegs, 0) > 0)),
    exists (select 1 from public.closing_stocks cs
            where cs.stock_account_id = p_account and cs.stock_date = p_date),
    (select cs.value from public.closing_stocks cs
      where cs.stock_account_id = p_account and cs.stock_date = p_date);
end;
$$;

-- Posts the total as the day's closing stock. Closing Stock does the rest: the journal,
-- the rule that a change needs a reason, and the days after.
create function public.post_stock_count_closing(p_account uuid, p_date date, p_reason text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_points integer;
  v_complete integer;
  v_unpriced integer;
begin
  if not public.has_access('stock_count_post', 'edit') then
    raise exception 'You do not have permission to post closing stock.' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Choose the stock date.';
  end if;

  select coalesce(sum(v.value), 0) into v_total from public.stock_count_line_values(p_date, p_date) v;
  select count(*)::integer into v_points
  from public.stock_points sp where sp.type = 'liquor' and sp.status = 'active';
  select count(*)::integer into v_complete
  from public.stock_counts c join public.stock_points sp on sp.id = c.stock_point_id
  where c.stock_date = p_date and c.status = 'complete' and sp.type = 'liquor' and sp.status = 'active';
  select count(*)::integer into v_unpriced
  from public.stock_count_line_values(p_date, p_date) v
  where not v.priced and (coalesce(v.bottles, 0) > 0 or coalesce(v.pegs, 0) > 0);

  if v_points = 0 or v_complete < v_points then
    raise exception 'Every liquor stock point needs a saved, Complete count for this date.';
  end if;
  if v_unpriced > 0 then
    raise exception '% counted items have no rate on this date. Add their rates first.', v_unpriced;
  end if;

  perform public.save_closing_stock(
    p_account, p_date, v_total,
    'From stock counts of ' || to_char(p_date, 'DD/MM/YYYY'),
    p_reason
  );
  return v_total;
end;
$$;

-- Who may call what ----------------------------------------------------------------------

revoke all on function public.stock_count_points() from public, anon;
revoke all on function public.stock_count_items() from public, anon;
revoke all on function public.stock_count_set_line(uuid, date, uuid, integer, numeric, text) from public, anon;
revoke all on function public.save_stock_count(uuid, date, text) from public, anon;
revoke all on function public.stock_count_list(date, date, uuid, public.stock_count_status) from public, anon;
revoke all on function public.stock_count_value_summary(date) from public, anon;
revoke all on function public.stock_count_post_preview(uuid, date) from public, anon;
revoke all on function public.post_stock_count_closing(uuid, date, text) from public, anon;

grant execute on function public.stock_count_points() to authenticated;
grant execute on function public.stock_count_items() to authenticated;
grant execute on function public.stock_count_set_line(uuid, date, uuid, integer, numeric, text) to authenticated;
grant execute on function public.save_stock_count(uuid, date, text) to authenticated;
grant execute on function public.stock_count_list(date, date, uuid, public.stock_count_status) to authenticated;
grant execute on function public.stock_count_value_summary(date) to authenticated;
grant execute on function public.stock_count_post_preview(uuid, date) to authenticated;
grant execute on function public.post_stock_count_closing(uuid, date, text) to authenticated;
