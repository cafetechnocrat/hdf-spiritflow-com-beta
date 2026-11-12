-- One-time reset (owner decision): keep only the admin account and the default
-- accounting groups. Everything else is deleted for good, including every other
-- user, all ledgers, vouchers, stock points, outlets, counters, transaction
-- dates and the audit log. Voucher types, their ledger rules and the settings
-- stay. Voucher numbering starts again from 1.
--
-- Safe on a database with no admin account: it does nothing then, so applying
-- the migrations to a fresh project never wipes anything.

do $$
declare
  v_admin uuid;
begin
  select u.id into v_admin
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email = 'admin@spiritflowhdf.com'
    and p.role = 'system_admin';

  if v_admin is null then
    raise notice 'Reset skipped: the admin account was not found.';
    return;
  end if;

  -- The audit log can never be changed, so lift that for this one reset.
  alter table public.audit_log disable trigger audit_log_no_update_delete;
  alter table public.audit_log disable trigger audit_log_no_truncate;
  delete from public.audit_log;

  -- Vouchers and everything on them.
  perform set_config('app.allow_voucher_delete', 'on', true);
  delete from public.voucher_entries;
  delete from public.vouchers;
  perform set_config('app.allow_voucher_delete', 'off', true);
  delete from public.voucher_counters;
  delete from public.user_preferences;

  -- Ledgers, and the groups the owner added. The default groups stay.
  delete from public.ledgers;
  loop
    delete from public.ledger_groups g
    where not g.is_default
      and not exists (select 1 from public.ledger_groups c where c.parent_id = g.id);
    exit when not found;
  end loop;

  -- Stock points, outlets and counters.
  delete from public.counters;
  delete from public.outlets;
  delete from public.stock_points;

  -- Every user except the admin.
  update public.profiles set created_by = null, updated_by = null where id = v_admin;
  delete from public.profiles where id <> v_admin;
  delete from auth.users where id <> v_admin;
  update public.profiles set status = 'active' where id = v_admin;
  update auth.users set banned_until = null where id = v_admin;

  -- Clear what the deletes above just logged, then put the protection back.
  delete from public.audit_log;
  alter table public.audit_log enable trigger audit_log_no_update_delete;
  alter table public.audit_log enable trigger audit_log_no_truncate;
end;
$$;
