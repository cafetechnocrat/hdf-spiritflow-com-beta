-- The System Admin can now create, edit and delete ledger groups and ledgers,
-- as well as the Chief Accountant. Everything else stays as it was: default
-- groups can never be deleted, and only an inactive record can be deleted.

drop policy ledger_groups_insert on public.ledger_groups;
create policy ledger_groups_insert on public.ledger_groups
  for insert to authenticated
  with check (
    (select public.current_user_role()) in ('chief_accountant', 'system_admin')
    and not is_default
  );

drop policy ledger_groups_update on public.ledger_groups;
create policy ledger_groups_update on public.ledger_groups
  for update to authenticated
  using ((select public.current_user_role()) in ('chief_accountant', 'system_admin'))
  with check ((select public.current_user_role()) in ('chief_accountant', 'system_admin'));

drop policy ledger_groups_delete on public.ledger_groups;
create policy ledger_groups_delete on public.ledger_groups
  for delete to authenticated
  using (
    (select public.current_user_role()) in ('chief_accountant', 'system_admin')
    and status = 'inactive' and not is_default
  );

drop policy ledgers_insert on public.ledgers;
create policy ledgers_insert on public.ledgers
  for insert to authenticated
  with check ((select public.current_user_role()) in ('chief_accountant', 'system_admin'));

drop policy ledgers_update on public.ledgers;
create policy ledgers_update on public.ledgers
  for update to authenticated
  using ((select public.current_user_role()) in ('chief_accountant', 'system_admin'))
  with check ((select public.current_user_role()) in ('chief_accountant', 'system_admin'));

drop policy ledgers_delete on public.ledgers;
create policy ledgers_delete on public.ledgers
  for delete to authenticated
  using (
    (select public.current_user_role()) in ('chief_accountant', 'system_admin')
    and status = 'inactive'
  );
