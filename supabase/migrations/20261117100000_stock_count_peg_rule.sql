-- Stock Count: pegs go in halves, up to 16.
-- A peg count is 0, 0.5, 1, 1.5 and so on, and never more than 16. The rule is held in
-- the database as well as on the screen. The check does not touch rows already saved,
-- so a posted count stays exactly as it was posted.

alter table public.stock_count_lines drop constraint if exists stock_count_lines_pegs_check;
alter table public.stock_count_lines
  add constraint stock_count_lines_pegs_rule
  check (pegs is null or (pegs >= 0 and pegs <= 16 and pegs * 2 = trunc(pegs * 2)))
  not valid;

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
  if p_pegs is not null and (p_pegs < 0 or p_pegs > 16 or p_pegs * 2 <> trunc(p_pegs * 2)) then
    raise exception 'Pegs must be in halves (0.5, 1, 1.5 and so on) and not more than 16.';
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
