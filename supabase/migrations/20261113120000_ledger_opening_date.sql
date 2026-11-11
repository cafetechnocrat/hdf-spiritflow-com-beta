-- Each ledger's opening balance is as on a date chosen by the user. No date is
-- fixed in the system. The date is required whenever there is an opening balance.

alter table public.ledgers add column opening_date date;

create or replace function public.check_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grp record;
begin
  select g.nature, g.status into grp from public.ledger_groups g where g.id = new.group_id;
  if not found then
    raise exception 'Choose a group.';
  end if;
  if new.status = 'active' and grp.status <> 'active' then
    raise exception 'Choose an active group. This group is inactive.';
  end if;
  if grp.nature in ('income', 'expenses')
     and (new.opening_amount <> 0 or new.opening_date is not null) then
    raise exception 'Income and expense ledgers have no opening balance.';
  end if;
  if new.opening_amount <> 0 and new.opening_date is null then
    raise exception 'Choose the date the opening balance is as on.';
  end if;
  return new;
end;
$$;
