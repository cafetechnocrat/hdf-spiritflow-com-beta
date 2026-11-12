-- The Day Book lists the newest entries first. The row limit now keeps the newest
-- rows, so a long range loses the oldest days, not the latest. Rows of one voucher
-- stay together in their own order.

create or replace function public.report_day_book(
  p_from date,
  p_to date,
  p_type uuid,
  p_ledger uuid,
  p_show_void boolean,
  p_limit integer
)
returns table (
  voucher_id uuid,
  voucher_date date,
  type_name text,
  reference_no text,
  reference text,
  narration text,
  status public.voucher_status,
  debit_name text,
  credit_name text,
  amount_text text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_lock_open('report_day_book');
  return query
    select r.voucher_id, r.voucher_date, r.type_name, r.reference_no, r.reference,
           r.narration, r.status, r.debit_name, r.credit_name, r.amount_text
    from public.day_book_rows r
    where r.voucher_date between p_from and p_to
      and (p_show_void or r.status = 'posted')
      and (p_type is null or r.voucher_type_id = p_type)
      and (p_ledger is null or r.debit_ledger_id = p_ledger or r.credit_ledger_id = p_ledger)
    order by r.voucher_date desc, r.created_at desc, r.reference_no desc, r.voucher_id, r.line_no
    limit p_limit;
end;
$$;
