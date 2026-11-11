-- While the system is being built, the System Admin has every right on
-- vouchers: edit, void and delete, as well as the Chief Accountant for edit and
-- void. Delete is a real delete and exists for development. The audit log keeps
-- the old values. Review this before the system goes live.
-- Also adds the ledger balance shown when a ledger is picked on a voucher.

-- Edit and void: Chief Accountant and System Admin ---------------------------

create or replace function public.save_voucher(
  p_id uuid,
  p_type uuid,
  p_date date,
  p_reference text,
  p_narration text,
  p_reason text,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_fy integer;
  v_number integer;
  v_old record;
begin
  if not (public.current_user_role() in ('chief_accountant', 'accounts_staff', 'system_admin')) then
    raise exception 'You do not have permission to enter vouchers.' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Choose the transaction date.';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) = 0 then
    raise exception 'Add at least one row.';
  end if;

  v_fy := case
    when extract(month from p_date) >= 4 then extract(year from p_date)::integer
    else extract(year from p_date)::integer - 1
  end;

  if p_id is null then
    if p_type is null then
      raise exception 'Choose the voucher type.';
    end if;
    insert into public.voucher_counters as c (voucher_type_id, fy_start_year, last_number)
    values (p_type, v_fy, 1)
    on conflict (voucher_type_id, fy_start_year)
    do update set last_number = c.last_number + 1
    returning c.last_number into v_number;

    insert into public.vouchers (
      voucher_type_id, voucher_date, fy_start_year, number, reference, narration, created_by
    ) values (
      p_type, p_date, v_fy, v_number, nullif(btrim(p_reference), ''),
      nullif(btrim(p_narration), ''), auth.uid()
    ) returning id into v_id;
  else
    if not (public.current_user_role() in ('chief_accountant', 'system_admin')) then
      raise exception 'Only the Chief Accountant or System Admin can edit a posted voucher.'
        using errcode = '42501';
    end if;
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'Enter the reason for the edit.';
    end if;
    select v.status, v.fy_start_year into v_old
    from public.vouchers v where v.id = p_id for update;
    if not found then
      raise exception 'That voucher was not found.';
    end if;
    if v_old.status <> 'posted' then
      raise exception 'A void voucher cannot be edited.';
    end if;
    if v_old.fy_start_year <> v_fy then
      raise exception 'The date must stay in the same financial year (April to March). Void this voucher and enter a new one instead.';
    end if;

    update public.vouchers
    set voucher_date = p_date,
        reference = nullif(btrim(p_reference), ''),
        narration = nullif(btrim(p_narration), ''),
        edit_reason = btrim(p_reason)
    where id = p_id;
    delete from public.voucher_entries where voucher_id = p_id;
    v_id := p_id;
  end if;

  insert into public.voucher_entries (
    voucher_id, line_no, debit_ledger_id, credit_ledger_id, amount, created_by
  )
  select v_id,
         t.ordinality::integer,
         (t.entry ->> 'debit')::uuid,
         (t.entry ->> 'credit')::uuid,
         (t.entry ->> 'amount')::numeric,
         auth.uid()
  from jsonb_array_elements(p_entries) with ordinality as t (entry, ordinality);

  return v_id;
end;
$$;

create or replace function public.void_voucher(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.current_user_role() in ('chief_accountant', 'system_admin')) then
    raise exception 'Only the Chief Accountant or System Admin can void a voucher.'
      using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Enter the reason for voiding.';
  end if;
  update public.vouchers
  set status = 'void',
      void_reason = btrim(p_reason),
      voided_at = now(),
      voided_by = auth.uid()
  where id = p_id and status = 'posted';
  if not found then
    raise exception 'That voucher was not found, or it is already void.';
  end if;
end;
$$;

-- Delete: System Admin only ---------------------------------------------------
-- A voucher can only be deleted through this function. The function raises a
-- flag for the length of the transaction, and the delete trigger checks it.

create or replace function public.block_voucher_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.allow_voucher_delete', true), '') <> 'on' then
    raise exception 'A voucher cannot be deleted directly.';
  end if;
  return old;
end;
$$;

create function public.delete_voucher(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() <> 'system_admin' then
    raise exception 'Only the System Admin can delete a voucher.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.vouchers where id = p_id) then
    raise exception 'That voucher was not found.';
  end if;
  perform set_config('app.allow_voucher_delete', 'on', true);
  delete from public.voucher_entries where voucher_id = p_id;
  delete from public.vouchers where id = p_id;
  perform set_config('app.allow_voucher_delete', 'off', true);
end;
$$;

revoke all on function public.delete_voucher(uuid) from public, anon;
grant execute on function public.delete_voucher(uuid) to authenticated;

-- Ledger balance as on a date -------------------------------------------------
-- Opening balance plus posted debits minus posted credits up to the date. A
-- balance that has gone the other way comes back on the opposite side with no
-- minus sign, as Tally does. The voucher being edited can be left out.

create function public.ledger_balances(
  p_date date,
  p_ledger_ids uuid[],
  p_exclude uuid default null
)
returns table (ledger_id uuid, amount_text text, side public.balance_side)
language sql
stable
set search_path = ''
as $$
  with net as (
    select
      l.id,
      (case when l.opening_side = 'dr' then l.opening_amount else -l.opening_amount end)
      + coalesce((
          select sum(e.amount)
          from public.voucher_entries e
          join public.vouchers v on v.id = e.voucher_id
          where e.debit_ledger_id = l.id
            and v.status = 'posted'
            and v.voucher_date <= p_date
            and v.id is distinct from p_exclude
        ), 0)
      - coalesce((
          select sum(e.amount)
          from public.voucher_entries e
          join public.vouchers v on v.id = e.voucher_id
          where e.credit_ledger_id = l.id
            and v.status = 'posted'
            and v.voucher_date <= p_date
            and v.id is distinct from p_exclude
        ), 0) as amount
    from public.ledgers l
    where l.id = any (p_ledger_ids)
  )
  select
    n.id,
    abs(n.amount)::text,
    case
      when n.amount > 0 then 'dr'::public.balance_side
      when n.amount < 0 then 'cr'::public.balance_side
      else null
    end
  from net n;
$$;

revoke all on function public.ledger_balances(date, uuid[], uuid) from public, anon;
grant execute on function public.ledger_balances(date, uuid[], uuid) to authenticated;
