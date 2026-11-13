-- Liquor Item Master (docs/07-Liquor-Item-Master.md).
-- Four tables: categories, types, items and the rate ledger. An item holds
-- identity only. Prices live in the rate ledger, one row per price change with
-- its effective date. Rate and cost per bottle and per peg are worked out from a
-- rate row and the item's size, never stored. Stock and average cost belong to
-- the stock phase and are not here.

-- The features ------------------------------------------------------------------

insert into public.features
  (key, label, group_label, sort_order, offers_view, offers_edit, offers_delete) values
  ('liquor_items', 'Liquor Items', 'Inventory Management', 60, true, true, false),
  ('liquor_rates', 'Liquor Rates', 'Inventory Management', 61, true, true, false);

-- Whoever manages ledgers starts with the same on the item master. The System Admin
-- always has full access. Access can be changed on the Roles screen.
insert into public.role_access (role_id, feature_key, can_view, can_edit, can_delete)
select a.role_id, f.key, a.can_view, a.can_edit, false
from public.role_access a
cross join (values ('liquor_items'), ('liquor_rates')) as f (key)
where a.feature_key = 'ledgers' and a.can_view
on conflict (role_id, feature_key) do nothing;

-- Categories and types -----------------------------------------------------------

create table public.liquor_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 60),
  sort_order integer not null default 0,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index liquor_categories_name_key on public.liquor_categories (lower(btrim(name)));

create table public.liquor_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 30),
  description text check (description is null or length(description) <= 100),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index liquor_types_name_key on public.liquor_types (lower(btrim(name)));

-- The items --------------------------------------------------------------------

create table public.liquor_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null check (length(btrim(item_code)) > 0 and length(item_code) <= 30),
  item_name text not null check (length(btrim(item_name)) > 0 and length(item_name) <= 200),
  stock_name text not null check (length(btrim(stock_name)) > 0 and length(stock_name) <= 200),
  type_id uuid not null references public.liquor_types (id) on delete restrict,
  category_id uuid not null references public.liquor_categories (id) on delete restrict,
  volume_ml integer not null check (volume_ml > 0 and volume_ml <= 10000),
  bottles_per_case integer not null check (bottles_per_case > 0 and bottles_per_case <= 500),
  peg_sale_allowed boolean not null default false,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index liquor_items_code_key on public.liquor_items (upper(btrim(item_code)));
create index liquor_items_category_idx on public.liquor_items (category_id);
create index liquor_items_status_idx on public.liquor_items (status);

-- The rate ledger ---------------------------------------------------------------

-- The cess per bottle follows the FL1 shop price: below 500 none, 500 to 999 it is
-- 20, 1000 and above it is 40. A price of exactly 500 or 1000 falls in the higher
-- slab; no item in the BevCo list sits on either boundary.
create function public.liquor_cess(p_fl1_price numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_fl1_price >= 1000 then 40
    when p_fl1_price >= 500 then 20
    else 0
  end::numeric;
$$;

create table public.liquor_item_rates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.liquor_items (id) on delete restrict,
  effective_date date not null,
  case_rate numeric(12, 2) not null check (case_rate >= 0),
  fl1_price numeric(12, 2) not null check (fl1_price >= 0),
  -- Set by the database from the FL1 price, never typed.
  cess_amount numeric(8, 2) not null default 0 check (cess_amount >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index liquor_item_rates_key on public.liquor_item_rates (item_id, effective_date);

create function public.set_liquor_cess()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cess_amount := public.liquor_cess(new.fl1_price);
  return new;
end;
$$;

create trigger liquor_item_rates_cess
  before insert on public.liquor_item_rates
  for each row execute function public.set_liquor_cess();

-- Triggers: audit columns and the audit log ------------------------------------

create trigger liquor_categories_set_updated before update on public.liquor_categories
  for each row execute function public.set_updated_fields();
create trigger liquor_types_set_updated before update on public.liquor_types
  for each row execute function public.set_updated_fields();
create trigger liquor_items_set_updated before update on public.liquor_items
  for each row execute function public.set_updated_fields();
create trigger liquor_item_rates_set_updated before update on public.liquor_item_rates
  for each row execute function public.set_updated_fields();

create trigger liquor_categories_audit
  after insert or update or delete on public.liquor_categories
  for each row execute function public.write_audit_row();
create trigger liquor_types_audit
  after insert or update or delete on public.liquor_types
  for each row execute function public.write_audit_row();
create trigger liquor_items_audit
  after insert or update or delete on public.liquor_items
  for each row execute function public.write_audit_row();
create trigger liquor_item_rates_audit
  after insert or update or delete on public.liquor_item_rates
  for each row execute function public.write_audit_row();

-- Row Level Security -------------------------------------------------------------
-- Nothing is deleted. A rate row is never changed: a price change is a new row.

alter table public.liquor_categories enable row level security;
alter table public.liquor_types enable row level security;
alter table public.liquor_items enable row level security;
alter table public.liquor_item_rates enable row level security;

revoke all on public.liquor_categories from anon, authenticated;
revoke all on public.liquor_types from anon, authenticated;
revoke all on public.liquor_items from anon, authenticated;
revoke all on public.liquor_item_rates from anon, authenticated;

grant select, insert, update on public.liquor_categories to authenticated;
grant select, insert, update on public.liquor_types to authenticated;
grant select, insert, update on public.liquor_items to authenticated;
grant select, insert on public.liquor_item_rates to authenticated;

create policy liquor_categories_select on public.liquor_categories
  for select to authenticated using ((select public.has_access('liquor_items', 'view')));
create policy liquor_categories_insert on public.liquor_categories
  for insert to authenticated with check ((select public.has_access('liquor_items', 'edit')));
create policy liquor_categories_update on public.liquor_categories
  for update to authenticated
  using ((select public.has_access('liquor_items', 'edit')))
  with check ((select public.has_access('liquor_items', 'edit')));

create policy liquor_types_select on public.liquor_types
  for select to authenticated using ((select public.has_access('liquor_items', 'view')));
create policy liquor_types_insert on public.liquor_types
  for insert to authenticated with check ((select public.has_access('liquor_items', 'edit')));
create policy liquor_types_update on public.liquor_types
  for update to authenticated
  using ((select public.has_access('liquor_items', 'edit')))
  with check ((select public.has_access('liquor_items', 'edit')));

create policy liquor_items_select on public.liquor_items
  for select to authenticated using ((select public.has_access('liquor_items', 'view')));
create policy liquor_items_insert on public.liquor_items
  for insert to authenticated with check ((select public.has_access('liquor_items', 'edit')));
create policy liquor_items_update on public.liquor_items
  for update to authenticated
  using ((select public.has_access('liquor_items', 'edit')))
  with check ((select public.has_access('liquor_items', 'edit')));

create policy liquor_item_rates_select on public.liquor_item_rates
  for select to authenticated using ((select public.has_access('liquor_rates', 'view')));
create policy liquor_item_rates_insert on public.liquor_item_rates
  for insert to authenticated with check ((select public.has_access('liquor_rates', 'edit')));

-- Starting categories and types ----------------------------------------------------
-- Reference lists, not business data. More can be added on the screen.

insert into public.liquor_categories (name, sort_order) values
  ('Beer', 1), ('Brandy', 2), ('Gin', 3), ('Liqueur', 4), ('Rum', 5),
  ('Tequila', 6), ('Vodka', 7), ('Whisky', 8), ('White Rum', 9), ('Wine', 10);

insert into public.liquor_types (name, description) values
  ('IMFL', 'Indian Made Foreign Liquor'),
  ('FMFL', 'Foreign Made Foreign Liquor');

-- The item list ----------------------------------------------------------------------
-- One page of items with the rate in force on a date, filtered and counted in the
-- database. Runs as the caller, so Row Level Security applies.

create function public.liquor_items_list(
  p_as_on date,
  p_search text,
  p_category uuid,
  p_type uuid,
  p_volume integer,
  p_peg boolean,
  p_status public.record_status,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  item_code text,
  item_name text,
  stock_name text,
  type_id uuid,
  type_name text,
  category_id uuid,
  category_name text,
  volume_ml integer,
  bottles_per_case integer,
  peg_sale_allowed boolean,
  status public.record_status,
  case_rate numeric,
  fl1_price numeric,
  cess_amount numeric,
  rate_from date,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.has_access('liquor_items', 'view') then
    raise exception 'You do not have permission to see liquor items.' using errcode = '42501';
  end if;
  return query
  select
    i.id, i.item_code, i.item_name, i.stock_name,
    i.type_id, t.name, i.category_id, c.name,
    i.volume_ml, i.bottles_per_case, i.peg_sale_allowed, i.status,
    r.case_rate, r.fl1_price, r.cess_amount, r.effective_date,
    count(*) over ()
  from public.liquor_items i
  join public.liquor_types t on t.id = i.type_id
  join public.liquor_categories c on c.id = i.category_id
  left join lateral (
    select x.case_rate, x.fl1_price, x.cess_amount, x.effective_date
    from public.liquor_item_rates x
    where x.item_id = i.id and x.effective_date <= p_as_on
    order by x.effective_date desc
    limit 1
  ) r on true
  where (p_category is null or i.category_id = p_category)
    and (p_type is null or i.type_id = p_type)
    and (p_volume is null or i.volume_ml = p_volume)
    and (p_peg is null or i.peg_sale_allowed = p_peg)
    and (p_status is null or i.status = p_status)
    and (
      v_search is null
      or i.item_code ilike '%' || v_search || '%'
      or i.item_name ilike '%' || v_search || '%'
      or i.stock_name ilike '%' || v_search || '%'
    )
  order by c.sort_order, c.name, i.stock_name, i.volume_ml, i.item_code
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.liquor_items_list(date, text, uuid, uuid, integer, boolean, public.record_status, integer, integer) from public, anon;
grant execute on function public.liquor_items_list(date, text, uuid, uuid, integer, boolean, public.record_status, integer, integer) to authenticated;

-- How many items each category and type holds.
create function public.liquor_lookup_counts()
returns table (kind text, id uuid, items bigint, active_items bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.has_access('liquor_items', 'view') then
    raise exception 'You do not have permission to see liquor items.' using errcode = '42501';
  end if;
  return query
  select 'category', i.category_id, count(*), count(*) filter (where i.status = 'active')
  from public.liquor_items i group by i.category_id
  union all
  select 'type', i.type_id, count(*), count(*) filter (where i.status = 'active')
  from public.liquor_items i group by i.type_id;
end;
$$;

revoke all on function public.liquor_lookup_counts() from public, anon;
grant execute on function public.liquor_lookup_counts() to authenticated;

-- Excel import -----------------------------------------------------------------------
-- Takes the checked rows of the file as json and saves them in one go: any new
-- category or type, any new item, and the rate rows. A first load adds items and
-- rates. A price list update adds a rate row only where the price changed.
-- Each row: item_code, item_name, stock_name, type, category, volume_ml,
-- bottles_per_case, peg_sale_allowed, status, case_rate, fl1_price.

create function public.import_liquor_items(
  p_rows jsonb,
  p_effective date,
  p_first_load boolean
)
returns table (items_added integer, rates_added integer, categories_added integer, types_added integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  v_cat uuid;
  v_type uuid;
  v_item uuid;
  v_order integer;
  n_items integer := 0;
  n_rates integer := 0;
  n_cats integer := 0;
  n_types integer := 0;
  v_case numeric;
  v_fl1 numeric;
  v_last record;
  v_changed boolean;
begin
  if not (public.has_access('liquor_items', 'edit') and public.has_access('liquor_rates', 'edit')) then
    raise exception 'You do not have permission to import liquor items.' using errcode = '42501';
  end if;
  if p_effective is null then
    raise exception 'Choose the date the rates are effective from.';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    -- Category and type are created when the file brings a new one.
    select id into v_cat from public.liquor_categories
      where lower(btrim(name)) = lower(btrim(r ->> 'category'));
    if v_cat is null then
      select coalesce(max(sort_order), 0) + 1 into v_order from public.liquor_categories;
      insert into public.liquor_categories (name, sort_order)
        values (initcap(btrim(r ->> 'category')), v_order) returning id into v_cat;
      n_cats := n_cats + 1;
    end if;

    select id into v_type from public.liquor_types
      where lower(btrim(name)) = lower(btrim(r ->> 'type'));
    if v_type is null then
      insert into public.liquor_types (name) values (upper(btrim(r ->> 'type')))
        returning id into v_type;
      n_types := n_types + 1;
    end if;

    select id into v_item from public.liquor_items
      where upper(btrim(item_code)) = upper(btrim(r ->> 'item_code'));

    if v_item is null then
      if not p_first_load then
        -- A price list update does not create items.
        continue;
      end if;
      insert into public.liquor_items
        (item_code, item_name, stock_name, type_id, category_id, volume_ml,
         bottles_per_case, peg_sale_allowed, status)
      values (
        btrim(r ->> 'item_code'), btrim(r ->> 'item_name'), btrim(r ->> 'stock_name'),
        v_type, v_cat, (r ->> 'volume_ml')::integer, (r ->> 'bottles_per_case')::integer,
        coalesce((r ->> 'peg_sale_allowed')::boolean, false),
        coalesce((r ->> 'status')::public.record_status, 'inactive')
      ) returning id into v_item;
      n_items := n_items + 1;
    end if;

    v_case := (r ->> 'case_rate')::numeric;
    v_fl1 := (r ->> 'fl1_price')::numeric;

    -- Add a rate row only when the rate in force is different.
    v_changed := true;
    for v_last in
      select x.case_rate, x.fl1_price
      from public.liquor_item_rates x
      where x.item_id = v_item and x.effective_date <= p_effective
      order by x.effective_date desc limit 1
    loop
      v_changed := v_last.case_rate <> v_case or v_last.fl1_price <> v_fl1;
    end loop;

    if v_changed then
      insert into public.liquor_item_rates (item_id, effective_date, case_rate, fl1_price)
      values (v_item, p_effective, v_case, v_fl1)
      on conflict (item_id, effective_date) do nothing;
      if found then n_rates := n_rates + 1; end if;
    end if;
  end loop;

  return query select n_items, n_rates, n_cats, n_types;
end;
$$;

revoke all on function public.import_liquor_items(jsonb, date, boolean) from public, anon;
grant execute on function public.import_liquor_items(jsonb, date, boolean) to authenticated;
