-- System Admin can now view ledger groups and ledgers, so the screen shows in
-- their menu. Only the Chief Accountant can create or change them.

drop policy ledger_groups_select on public.ledger_groups;
create policy ledger_groups_select on public.ledger_groups
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));

drop policy ledgers_select on public.ledgers;
create policy ledgers_select on public.ledgers
  for select to authenticated
  using ((select public.current_user_role()) in (
    'md', 'system_admin', 'chief_accountant', 'accounts_staff'
  ));
