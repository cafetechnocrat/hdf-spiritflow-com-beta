import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HistoryRow, StockAccount } from "./types";

type AccountRecord = {
  id: string;
  name: string;
  stock_ledger: string;
  adjustment_ledger: string;
};

type HistoryRecord = {
  stock_date: string;
  value_text: string;
  diff_text: string;
  voucher_id: string | null;
  type_name: string | null;
  reference_no: string | null;
  note: string | null;
};

// The stock accounts the person may see. Read through a function that checks
// the Closing Stock access, so the ledger names come back too.
export async function loadStockAccounts(): Promise<StockAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("closing_stock_accounts");
  if (error) throw new Error("accounts");
  return ((data ?? []) as AccountRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    stockLedger: row.stock_ledger,
    adjustmentLedger: row.adjustment_ledger,
  }));
}

export async function loadClosingStockHistory(accountId: string): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("closing_stock_history", { p_account: accountId });
  if (error) throw new Error("history");
  return ((data ?? []) as HistoryRecord[]).map((row) => ({
    date: row.stock_date,
    value: row.value_text,
    diff: row.diff_text,
    voucherId: row.voucher_id,
    typeName: row.type_name,
    referenceNo: row.reference_no,
    note: row.note,
  }));
}

// The book stock (debit positive) as on a date, as signed text.
export async function loadBookStock(accountId: string, asOn: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("closing_stock_book", {
    p_account: accountId,
    p_as_on: asOn,
  });
  if (error || typeof data !== "string") throw new Error("book");
  return data;
}
