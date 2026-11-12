-- Closing Stock: the daily stock adjustment (docs/06-Closing-Stock.md).
-- A stock account pairs a stock ledger (an asset) with an adjustment ledger (on
-- the trading side). Each day the accountant enters the closing stock value at
-- cost. The change from the book stock is posted as one Journal voucher, so the
-- books hold the real stock and Gross Profit uses the stock that was consumed.

-- The feature ------------------------------------------------------------------

insert into public.features
  (key, label, group_label, sort_order, offers_view, offers_edit, offers_delete) values
  ('closing_stock', 'Closing Stock', 'Accounts', 55, true, true, false);

-- Whoever can enter transactions starts with the same on Closing Stock.
insert into public.role_access (role_id, feature_key, can_view, can_edit, can_delete)
select a.role_id, 'closing_stock', a.can_view, a.can_edit, false
from public.role_access a
where a.feature_key = 'transactions' and a.can_view
on conflict (role_id, feature_key) do nothing;

-- Stock accounts ---------------------------------------------------------------

create table public.stock_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 60),
  stock_ledger_id uuid not null references public.ledgers (id) on delete restrict,
  adjustment_ledger_id uuid not null references public.ledgers (id) on delete restrict,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (stock_ledger_id <> adjustment_ledger_id)
);
create unique index stock_accounts_name_key on public.stock_accounts (lower(btrim(name)));
create unique index stock_accounts_stock_ledger_key on public.stock_accounts (stock_ledger_id);

create function public.check_stock_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nature_stock public.account_nature;
  nature_adjust public.account_nature;
begin
  select g.nature into nature_stock
  from public.ledgers l join public.ledger_groups g on g.id = l.group_id
  where l.id = new.stock_ledger_id;
  select g.nature into nature_adjust
  from public.ledgers l join public.ledger_groups g on g.id = l.group_id
  where l.id = new.adjustment_ledger_id;
  if nature_stock is distinct from 'assets' then
    raise exception 'The stock ledger must sit under an asset group.';
  end if;
  if nature_adjust not in ('expenses', 'income') then
    raise exception 'The adjustment ledger must sit under an expense or income group.';
  end if;
  return new;
end;
$$;

create trigger stock_accounts_check
  before insert or update on public.stock_accounts
  for each row execute function public.check_stock_account();
create trigger stock_accounts_set_updated before update on public.stock_accounts
  for each row execute function public.set_updated_fields();
create trigger stock_accounts_audit
  after insert or update or delete on public.stock_accounts
  for each row execute function public.write_audit_row();

-- Closing stock values ---------------------------------------------------------

create table public.closing_stocks (
  id uuid primary key default gen_random_uuid(),
  stock_account_id uuid not null references public.stock_accounts (id) on delete restrict,
  stock_date date not null,
  value numeric(14, 2) not null check (value >= 0),
  note text check (note is null or length(note) <= 300),
  -- The Journal voucher this value posted. Null when there was no change.
  voucher_id uuid references public.vouchers (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index closing_stocks_key on public.closing_stocks (stock_account_id, stock_date);

create trigger closing_stocks_set_updated before update on public.closing_stocks
  for each row execute function public.set_updated_fields();
create trigger closing_stocks_audit
  after insert or update or delete on public.closing_stocks
  for each row execute function public.write_audit_row();

alter table public.stock_accounts enable row level security;
alter table public.closing_stocks enable row level security;
revoke all on public.stock_accounts from anon, authenticated;
revoke all on public.closing_stocks from anon, authenticated;
grant select on public.stock_accounts to authenticated;
grant select on public.closing_stocks to authenticated;

create policy stock_accounts_select on public.stock_accounts
  for select to authenticated
  using ((select public.has_access('closing_stock', 'view')));
create policy closing_stocks_select on public.closing_stocks
  for select to authenticated
  using ((select public.has_access('closing_stock', 'view')));

-- Book stock -----------------------------------------------------------------------
-- The stock ledger balance as on a date (debit positive), opening included. With
-- p_without_journals the account's own closing-stock journals are left out, which
-- is what each day's journal is worked out from.

create function public.stock_book_balance(
  p_ledger uuid,
  p_as_on date,
  p_account uuid,
  p_without_journals boolean
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select case l.opening_side when 'dr' then l.opening_amount else -l.opening_amount end
      from public.ledgers l where l.id = p_ledger
    ), 0)
    + coalesce((
        select sum(e.amount)
        from public.voucher_entries e
        join public.vouchers v on v.id = e.voucher_id
        where e.debit_ledger_id = p_ledger
          and v.status = 'posted' and v.voucher_date <= p_as_on
          and not (p_without_journals and v.id in (
            select c.voucher_id from public.closing_stocks c
            where c.stock_account_id = p_account and c.voucher_id is not null))
      ), 0)
    - coalesce((
        select sum(e.amount)
        from public.voucher_entries e
        join public.vouchers v on v.id = e.voucher_id
        where e.credit_ledger_id = p_ledger
          and v.status = 'posted' and v.voucher_date <= p_as_on
          and not (p_without_journals and v.id in (
            select c.voucher_id from public.closing_stocks c
            where c.stock_account_id = p_account and c.voucher_id is not null))
      ), 0);
$$;

revoke all on function public.stock_book_balance(uuid, date, uuid, boolean)
  from public, anon, authenticated;

create function public.closing_stock_book(p_account uuid, p_as_on date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ledger uuid;
begin
  if not public.has_access('closing_stock', 'view') then
    raise exception 'You do not have permission to see closing stock.' using errcode = '42501';
  end if;
  select a.stock_ledger_id into v_ledger from public.stock_accounts a where a.id = p_account;
  if not found then
    raise exception 'That stock account was not found.';
  end if;
  return public.stock_book_balance(v_ledger, p_as_on, p_account, false)::text;
end;
$$;

-- The plan: what each day's journal must be --------------------------------------
-- A day's journal is its closing stock minus the book stock before it. Every
-- later day is worked out again, in date order, so the chain stays right. Rows
-- come back for the chosen date and every later one. diff is positive when stock
-- went up (debit the stock ledger). current_diff is what is posted now.

create function public.closing_stock_plan(
  p_account uuid,
  p_date date,
  p_value numeric
)
returns table (
  stock_date date,
  value numeric,
  diff numeric,
  current_diff numeric,
  is_target boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ledger uuid;
begin
  if not public.has_access('closing_stock', 'view') then
    raise exception 'You do not have permission to see closing stock.' using errcode = '42501';
  end if;
  select a.stock_ledger_id into v_ledger from public.stock_accounts a where a.id = p_account;
  if not found then
    raise exception 'That stock account was not found.';
  end if;
  return query
    with entered as (
      select c.stock_date as d, c.value as val, c.voucher_id as vid, false as tgt
      from public.closing_stocks c
      where c.stock_account_id = p_account and c.stock_date <> p_date
      union all
      select p_date, p_value,
        (select c.voucher_id from public.closing_stocks c
          where c.stock_account_id = p_account and c.stock_date = p_date),
        true
    ),
    ordered as (
      select e.d, e.val, e.vid, e.tgt,
        lag(e.val) over (order by e.d) as prev_val,
        lag(e.d) over (order by e.d) as prev_d
      from entered e
    ),
    calc as (
      select o.d, o.val, o.vid, o.tgt,
        o.val - public.stock_book_balance(v_ledger, o.d, p_account, true)
          - coalesce(
              o.prev_val - public.stock_book_balance(v_ledger, o.prev_d, p_account, true),
              0
            ) as df
      from ordered o
    )
    select c.d, c.val, c.df,
      coalesce((
        select sum(case when en.debit_ledger_id = v_ledger then en.amount else -en.amount end)
        from public.voucher_entries en
        join public.vouchers vo on vo.id = en.voucher_id
        where en.voucher_id = c.vid and vo.status = 'posted'
      ), 0),
      c.tgt
    from calc c
    where c.d >= p_date
    order by c.d;
end;
$$;

-- Saving ---------------------------------------------------------------------------

create function public.save_closing_stock(
  p_account uuid,
  p_date date,
  p_value numeric,
  p_note text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acct record;
  v_has_row boolean;
  v_journal uuid;
  r record;
  v_vid uuid;
  v_status public.voucher_status;
  v_debit uuid;
  v_credit uuid;
  v_amount numeric;
  v_fy integer;
  v_number integer;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Closing stock recalculated');
begin
  if not public.has_access('closing_stock', 'edit') then
    raise exception 'You do not have permission to enter closing stock.' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Choose the date.';
  end if;
  if p_value is null or p_value < 0 then
    raise exception 'Enter the closing stock value as an amount of zero or more.';
  end if;

  select a.id, a.stock_ledger_id, a.adjustment_ledger_id into v_acct
  from public.stock_accounts a where a.id = p_account and a.status = 'active';
  if not found then
    raise exception 'That stock account was not found, or it is not active.';
  end if;
  select t.id into v_journal from public.voucher_types t where t.name = 'Journal';
  if v_journal is null then
    raise exception 'The Journal voucher type was not found.';
  end if;

  select true into v_has_row from public.closing_stocks c
  where c.stock_account_id = p_account and c.stock_date = p_date;
  if v_has_row then
    if not public.has_access('voucher_changes', 'edit') then
      raise exception 'You do not have permission to change a closing stock that is already entered.'
        using errcode = '42501';
    end if;
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Enter the reason for the change.';
    end if;
  end if;

  insert into public.closing_stocks as c (stock_account_id, stock_date, value, note, created_by)
  values (p_account, p_date, p_value, nullif(btrim(p_note), ''), auth.uid())
  on conflict (stock_account_id, stock_date)
  do update set value = excluded.value, note = excluded.note;

  for r in select * from public.closing_stock_plan(p_account, p_date, p_value) loop
    if r.diff = r.current_diff then
      continue;
    end if;

    select c.voucher_id into v_vid from public.closing_stocks c
    where c.stock_account_id = p_account and c.stock_date = r.stock_date;
    if v_vid is not null then
      select v.status into v_status from public.vouchers v where v.id = v_vid;
      if v_status is distinct from 'posted' then
        v_vid := null;
      end if;
    end if;

    if r.diff = 0 then
      -- No change any more: the old journal is voided and the day keeps its value.
      if v_vid is not null then
        update public.vouchers
        set status = 'void', void_reason = v_reason, voided_at = now(), voided_by = auth.uid()
        where id = v_vid and status = 'posted';
      end if;
      update public.closing_stocks c set voucher_id = null
      where c.stock_account_id = p_account and c.stock_date = r.stock_date;
      continue;
    end if;

    if r.diff > 0 then
      v_debit := v_acct.stock_ledger_id;
      v_credit := v_acct.adjustment_ledger_id;
      v_amount := r.diff;
    else
      v_debit := v_acct.adjustment_ledger_id;
      v_credit := v_acct.stock_ledger_id;
      v_amount := -r.diff;
    end if;

    if v_vid is null then
      v_fy := case
        when extract(month from r.stock_date) >= 4 then extract(year from r.stock_date)::integer
        else extract(year from r.stock_date)::integer - 1
      end;
      insert into public.voucher_counters as vc (voucher_type_id, fy_start_year, last_number)
      values (v_journal, v_fy, 1)
      on conflict (voucher_type_id, fy_start_year)
      do update set last_number = vc.last_number + 1
      returning vc.last_number into v_number;

      insert into public.vouchers (
        voucher_type_id, voucher_date, fy_start_year, number, reference, narration, created_by
      ) values (
        v_journal, r.stock_date, v_fy, v_number, 'Closing Stock',
        'Closing stock on ' || to_char(r.stock_date, 'DD/MM/YYYY'), auth.uid()
      ) returning id into v_vid;

      update public.closing_stocks c set voucher_id = v_vid
      where c.stock_account_id = p_account and c.stock_date = r.stock_date;
    else
      update public.vouchers set edit_reason = v_reason where id = v_vid;
      delete from public.voucher_entries where voucher_id = v_vid;
    end if;

    insert into public.voucher_entries (
      voucher_id, line_no, debit_ledger_id, credit_ledger_id, amount, created_by
    ) values (v_vid, 1, v_debit, v_credit, v_amount, auth.uid());
  end loop;
end;
$$;

-- History for the screen -------------------------------------------------------------

create function public.closing_stock_history(p_account uuid)
returns table (
  stock_date date,
  value_text text,
  diff_text text,
  voucher_id uuid,
  type_name text,
  reference_no text,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ledger uuid;
begin
  if not public.has_access('closing_stock', 'view') then
    raise exception 'You do not have permission to see closing stock.' using errcode = '42501';
  end if;
  select a.stock_ledger_id into v_ledger from public.stock_accounts a where a.id = p_account;
  if not found then
    raise exception 'That stock account was not found.';
  end if;
  return query
    select
      c.stock_date,
      c.value::text,
      coalesce((
        select sum(case when en.debit_ledger_id = v_ledger then en.amount else -en.amount end)
        from public.voucher_entries en
        join public.vouchers vo on vo.id = en.voucher_id
        where en.voucher_id = c.voucher_id and vo.status = 'posted'
      ), 0)::text,
      case when s.status = 'posted' then c.voucher_id end,
      case when s.status = 'posted' then s.type_name end,
      case when s.status = 'posted' then s.reference_no end,
      c.note
    from public.closing_stocks c
    left join public.voucher_summaries s on s.id = c.voucher_id
    where c.stock_account_id = p_account
    order by c.stock_date desc;
end;
$$;

-- The accounts for the screen, with their ledger names ---------------------------------

create function public.closing_stock_accounts()
returns table (id uuid, name text, stock_ledger text, adjustment_ledger text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_access('closing_stock', 'view') then
    raise exception 'You do not have permission to see closing stock.' using errcode = '42501';
  end if;
  return query
    select a.id, a.name, sl.name, al.name
    from public.stock_accounts a
    join public.ledgers sl on sl.id = a.stock_ledger_id
    join public.ledgers al on al.id = a.adjustment_ledger_id
    where a.status = 'active'
    order by a.name;
end;
$$;

-- Grants ---------------------------------------------------------------------------------

revoke all on function public.closing_stock_book(uuid, date) from public, anon;
revoke all on function public.closing_stock_plan(uuid, date, numeric) from public, anon;
revoke all on function public.save_closing_stock(uuid, date, numeric, text, text) from public, anon;
revoke all on function public.closing_stock_history(uuid) from public, anon;
revoke all on function public.closing_stock_accounts() from public, anon;
grant execute on function public.closing_stock_book(uuid, date) to authenticated;
grant execute on function public.closing_stock_plan(uuid, date, numeric) to authenticated;
grant execute on function public.save_closing_stock(uuid, date, numeric, text, text) to authenticated;
grant execute on function public.closing_stock_history(uuid) to authenticated;
grant execute on function public.closing_stock_accounts() to authenticated;
