-- Lets the System Admin permanently delete a user, with a full audit record.
-- The audit log keeps the deleted profile's old values, so history is not lost.

-- 1. The audit log accepts a delete action.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (
  action in ('insert', 'update', 'void', 'delete', 'login', 'logout', 'failed_login')
);

-- 2. Deleting a user clears them as author of other profiles instead of
--    blocking. Who did what stays in the audit log.
alter table public.profiles drop constraint profiles_created_by_fkey;
alter table public.profiles
  add constraint profiles_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.profiles drop constraint profiles_updated_by_fkey;
alter table public.profiles
  add constraint profiles_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;

-- 3. Audit trigger: record deletes, and skip updates that only change the
--    bookkeeping columns (for example when an author is cleared).
create or replace function public.write_audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'insert', tg_table_name, new.id, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at' - 'updated_by' - 'created_by')
       = (to_jsonb(old) - 'updated_at' - 'updated_by' - 'created_by') then
      return null;
    end if;
    insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), 'update', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, action, table_name, record_id, old_data)
    values (auth.uid(), 'delete', tg_table_name, old.id, to_jsonb(old));
  end if;
  return null;
end;
$$;

drop trigger profiles_audit on public.profiles;
create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.write_audit_row();

-- 4. Only System Admin may delete a profile, and only an inactive one.
grant delete on public.profiles to authenticated;

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (
    (select public.current_user_role()) = 'system_admin'
    and status = 'inactive'
    and id <> (select auth.uid())
  );
