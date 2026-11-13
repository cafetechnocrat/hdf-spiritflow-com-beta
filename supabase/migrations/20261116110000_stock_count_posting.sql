-- Stock Count: edit and delete until posted.
-- A count can be changed or deleted until it is posted to the accounts. Posting to
-- Closing Stock locks every count of that date: no entry, no save, no delete.

-- Posted marker and the Delete right -------------------------------------------------

alter table public.stock_counts
  add column posted_at timestamptz,
  add column posted_by uuid references auth.users (id) on delete set null;

-- Stock Count now offers Delete: remove a count that is not posted. Roles that can take
-- stock start with it. It can be changed on the Roles screen.
update public.features set offers_delete = true where key = 'stock_count';
update public.role_access set can_delete = can_edit where feature_key = 'stock_count';

-- Entering --------------------------------------------------------------------------------

create or replace function public.stock_count_set_line(
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
  if exists (
    select 1 from public.stock_counts c
    where c.stock_point_id = p_point and c.stock_date = p_date and c.posted_at is not null
  ) then
    raise exception 'This count is posted to the accounts and can no longer be changed.';
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

create or replace function public.save_stock_count(p_point uuid, p_date date, p_by text)
returns table (missing integer, saved boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peg_point boolean;
  v_count uuid;
  v_posted timestamptz;
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
  select c.id, c.posted_at into v_count, v_posted from public.stock_counts c
  where c.stock_point_id = p_point and c.stock_date = p_date;
  if v_posted is not null then
    raise exception 'This count is posted to the accounts and can no longer be changed.';
  end if;

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

-- Deleting a count that is not posted. The audit log keeps what was in it.
create function public.delete_stock_count(p_point uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count uuid;
  v_posted timestamptz;
begin
  if not public.has_access('stock_count', 'delete') then
    raise exception 'You do not have permission to delete a stock count.' using errcode = '42501';
  end if;
  select c.id, c.posted_at into v_count, v_posted from public.stock_counts c
  where c.stock_point_id = p_point and c.stock_date = p_date;
  if v_count is null then
    raise exception 'That count was not found.';
  end if;
  if v_posted is not null then
    raise exception 'This count is posted to the accounts and cannot be deleted.';
  end if;
  delete from public.stock_count_lines where count_id = v_count;
  delete from public.stock_counts where id = v_count;
end;
$$;

-- Posting locks the counts of the date ------------------------------------------------------

create or replace function public.post_stock_count_closing(p_account uuid, p_date date, p_reason text)
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

  -- From here the counts of this date cannot be changed or deleted.
  update public.stock_counts c
  set posted_at = now(), posted_by = auth.uid()
  from public.stock_points sp
  where sp.id = c.stock_point_id and sp.type = 'liquor' and sp.status = 'active'
    and c.stock_date = p_date and c.status = 'complete' and c.posted_at is null;
  return v_total;
end;
$$;

-- The Past Counts list now says which counts are posted ---------------------------------------

drop function public.stock_count_list(date, date, uuid, public.stock_count_status);

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
  posted boolean,
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
    c.id, c.stock_point_id, sp.name, c.stock_date, c.status, c.posted_at is not null, c.counted_by,
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

revoke all on function public.delete_stock_count(uuid, date) from public, anon;
revoke all on function public.stock_count_list(date, date, uuid, public.stock_count_status) from public, anon;
grant execute on function public.delete_stock_count(uuid, date) to authenticated;
grant execute on function public.stock_count_list(date, date, uuid, public.stock_count_status) to authenticated;
