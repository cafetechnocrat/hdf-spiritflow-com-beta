-- Phase 1: stock points, outlets and counters.
-- A stock point holds stock. An outlet sells, and has one stock point or none.
-- Several outlets may share one stock point. A counter is a billing point that
-- belongs to one outlet.

create type public.stock_point_type as enum ('warehouse', 'bar', 'kitchen', 'restaurant');
create type public.outlet_type as enum ('bar', 'restaurant', 'front_office');
create type public.record_status as enum ('active', 'inactive');

-- Tables --------------------------------------------------------------------

create table public.stock_points (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9]{1,10}$'),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 100),
  type public.stock_point_type not null,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index stock_points_code_key on public.stock_points (code);
create unique index stock_points_name_key on public.stock_points (lower(btrim(name)));

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9]{1,10}$'),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 100),
  type public.outlet_type not null,
  -- One stock point at most. Restrict stops a linked stock point being deleted.
  stock_point_id uuid references public.stock_points (id) on delete restrict,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index outlets_code_key on public.outlets (code);
create unique index outlets_name_key on public.outlets (lower(btrim(name)));
create index outlets_stock_point_idx on public.outlets (stock_point_id);

create table public.counters (
  id uuid primary key default gen_random_uuid(),
  -- Restrict stops an outlet with counters being deleted.
  outlet_id uuid not null references public.outlets (id) on delete restrict,
  name text not null check (length(btrim(name)) > 0 and length(name) <= 100),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index counters_outlet_name_key on public.counters (outlet_id, lower(btrim(name)));

-- Link rules ----------------------------------------------------------------
-- The database holds these rules too, not only the app.

create function public.check_outlet_stock_point()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock_point_id is not null
     and (tg_op = 'INSERT' or new.stock_point_id is distinct from old.stock_point_id)
     and not exists (
       select 1 from public.stock_points sp
       where sp.id = new.stock_point_id and sp.status = 'active'
     ) then
    raise exception 'An outlet can only be linked to an active stock point.';
  end if;
  return new;
end;
$$;

create trigger outlets_check_stock_point
  before insert or update on public.outlets
  for each row execute function public.check_outlet_stock_point();

create function public.check_stock_point_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'inactive' and old.status = 'active'
     and exists (
       select 1 from public.outlets o
       where o.stock_point_id = new.id and o.status = 'active'
     ) then
    raise exception 'Move the active outlets to another stock point before deactivating this one.';
  end if;
  return new;
end;
$$;

create trigger stock_points_check_deactivation
  before update on public.stock_points
  for each row execute function public.check_stock_point_deactivation();

-- Bookkeeping and audit -----------------------------------------------------

create trigger stock_points_set_updated before update on public.stock_points
  for each row execute function public.set_updated_fields();
create trigger outlets_set_updated before update on public.outlets
  for each row execute function public.set_updated_fields();
create trigger counters_set_updated before update on public.counters
  for each row execute function public.set_updated_fields();

create trigger stock_points_audit
  after insert or update or delete on public.stock_points
  for each row execute function public.write_audit_row();
create trigger outlets_audit
  after insert or update or delete on public.outlets
  for each row execute function public.write_audit_row();
create trigger counters_audit
  after insert or update or delete on public.counters
  for each row execute function public.write_audit_row();

-- Row Level Security --------------------------------------------------------

alter table public.stock_points enable row level security;
alter table public.outlets enable row level security;
alter table public.counters enable row level security;

revoke all on public.stock_points from anon, authenticated;
revoke all on public.outlets from anon, authenticated;
revoke all on public.counters from anon, authenticated;

grant select, insert, update, delete on public.stock_points to authenticated;
grant select, insert, update, delete on public.outlets to authenticated;
grant select, insert, update, delete on public.counters to authenticated;

-- Readable by every role except Security and Cashier. Cashiers get their own
-- outlet and counter later, when outlet access is added.
create policy stock_points_select on public.stock_points
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff',
    'night_accountant', 'stock_keeper', 'kitchen_staff'
  ));
create policy outlets_select on public.outlets
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff',
    'night_accountant', 'stock_keeper', 'kitchen_staff'
  ));
create policy counters_select on public.counters
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff',
    'night_accountant', 'stock_keeper', 'kitchen_staff'
  ));

-- Only System Admin changes them. Only an inactive record can be deleted.
create policy stock_points_insert on public.stock_points
  for insert to authenticated
  with check ((select public.current_user_role()) = 'system_admin');
create policy stock_points_update on public.stock_points
  for update to authenticated
  using ((select public.current_user_role()) = 'system_admin')
  with check ((select public.current_user_role()) = 'system_admin');
create policy stock_points_delete on public.stock_points
  for delete to authenticated
  using ((select public.current_user_role()) = 'system_admin' and status = 'inactive');

create policy outlets_insert on public.outlets
  for insert to authenticated
  with check ((select public.current_user_role()) = 'system_admin');
create policy outlets_update on public.outlets
  for update to authenticated
  using ((select public.current_user_role()) = 'system_admin')
  with check ((select public.current_user_role()) = 'system_admin');
create policy outlets_delete on public.outlets
  for delete to authenticated
  using ((select public.current_user_role()) = 'system_admin' and status = 'inactive');

create policy counters_insert on public.counters
  for insert to authenticated
  with check ((select public.current_user_role()) = 'system_admin');
create policy counters_update on public.counters
  for update to authenticated
  using ((select public.current_user_role()) = 'system_admin')
  with check ((select public.current_user_role()) = 'system_admin');
create policy counters_delete on public.counters
  for delete to authenticated
  using ((select public.current_user_role()) = 'system_admin' and status = 'inactive');
