-- Financial year selector. Each user keeps the financial year they picked, and
-- the books begin date is a setting, so the list of years comes from the
-- database. A financial year runs from 1 April to 31 March. With no year picked
-- the current financial year is used.

alter table public.user_preferences
  add column fy_start_year integer check (fy_start_year between 2000 and 2200);

-- The day the books begin. The list of financial years starts with the year
-- that holds it. Seeded from the Tally setup in the Day Book spec.
insert into public.app_settings (key, value)
values ('books_begin_date', '2023-04-01')
on conflict (key) do nothing;

-- The MD can pick a financial year too, so reports follow it. Everyone who sees
-- the accounts keeps their own row.
drop policy user_preferences_select on public.user_preferences;
create policy user_preferences_select on public.user_preferences
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in (
      'md', 'chief_accountant', 'accounts_staff', 'system_admin'
    )
  );

drop policy user_preferences_insert on public.user_preferences;
create policy user_preferences_insert on public.user_preferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in (
      'md', 'chief_accountant', 'accounts_staff', 'system_admin'
    )
  );

drop policy user_preferences_update on public.user_preferences;
create policy user_preferences_update on public.user_preferences
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in (
      'md', 'chief_accountant', 'accounts_staff', 'system_admin'
    )
  )
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in (
      'md', 'chief_accountant', 'accounts_staff', 'system_admin'
    )
  );
