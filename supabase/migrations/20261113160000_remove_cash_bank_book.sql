-- The separate Cash And Bank Book is not needed, since the Ledger Statement
-- covers every ledger. This removes its function and the cash or bank flag on
-- ledger groups.

-- Rules and inheritance without the cash or bank flag.
create or replace function public.inherit_group_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select g.pl_section into parent
    from public.ledger_groups g where g.id = new.parent_id;
    if found and new.pl_section is null then
      new.pl_section := parent.pl_section;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.check_ledger_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
  walker uuid;
begin
  if tg_op = 'UPDATE' then
    if new.is_default is distinct from old.is_default then
      raise exception 'A group cannot change between default and custom.';
    end if;
    if new.nature is distinct from old.nature then
      raise exception 'The nature of a group cannot be changed.';
    end if;
    if old.is_default and new.parent_id is distinct from old.parent_id then
      raise exception 'A default group keeps its place.';
    end if;
  end if;

  if new.parent_id is null then
    if not new.is_default then
      raise exception 'A new group must sit under another group.';
    end if;
    return new;
  end if;

  select g.nature, g.status into parent
  from public.ledger_groups g where g.id = new.parent_id;
  if not found then
    raise exception 'Choose the group this one sits under.';
  end if;
  if parent.nature <> new.nature then
    raise exception 'A sub-group must have the same nature as its group.';
  end if;
  if new.status = 'active' and parent.status <> 'active'
     and (tg_op = 'INSERT'
          or new.parent_id is distinct from old.parent_id
          or new.status is distinct from old.status) then
    raise exception 'Choose an active group. The group above is inactive.';
  end if;

  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
    walker := new.parent_id;
    while walker is not null loop
      if walker = new.id then
        raise exception 'A group cannot sit under itself or its own sub-group.';
      end if;
      select g.parent_id into walker from public.ledger_groups g where g.id = walker;
    end loop;
  end if;

  return new;
end;
$$;

drop function public.report_cash_bank_days(date, date, uuid[]);
alter table public.ledger_groups drop column is_cash_bank;
