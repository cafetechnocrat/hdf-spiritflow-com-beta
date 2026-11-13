-- Stock point and outlet types, as the owner now defines them.
-- Stock point types: Liquor, Kitchen, House Keeping. A Liquor stock point can be
-- set to allow peg sale. Outlet types: Liquor, Food, Hospitality.
-- The three tables hold no rows when this runs. The mapping below only keeps the
-- change safe if a row exists.

-- Stock point types -------------------------------------------------------------

create type public.stock_point_type_new as enum ('liquor', 'kitchen', 'housekeeping');

alter table public.stock_points
  alter column type type public.stock_point_type_new
  using (
    case type::text
      when 'kitchen' then 'kitchen'
      when 'restaurant' then 'kitchen'
      else 'liquor'
    end
  )::public.stock_point_type_new;

drop type public.stock_point_type;
alter type public.stock_point_type_new rename to stock_point_type;

-- Peg sale is a Liquor choice. For the other types it is always off.
alter table public.stock_points
  add column peg_allowed boolean not null default false,
  add constraint stock_points_peg_only_liquor check (not peg_allowed or type = 'liquor');

-- Outlet types -------------------------------------------------------------------

create type public.outlet_type_new as enum ('liquor', 'food', 'hospitality');

alter table public.outlets
  alter column type type public.outlet_type_new
  using (
    case type::text
      when 'bar' then 'liquor'
      when 'restaurant' then 'food'
      else 'hospitality'
    end
  )::public.outlet_type_new;

drop type public.outlet_type;
alter type public.outlet_type_new rename to outlet_type;
