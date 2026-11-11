"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  balanceRequestSchema,
  idSchema,
  transactionDateSchema,
  voidSchema,
  voucherSchema,
  type BalancesResult,
  type EntriesResult,
  type VoucherResult,
} from "./schemas";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  notFound: "That voucher was not found.",
  badRows: "Check the rows. Each needs a debit ledger, a credit ledger and an amount.",
  needReason: "Enter the reason for the edit.",
  referenceMismatch: "The voucher number you typed does not match. Nothing was deleted.",
} as const;

const PATH = "/transactions";

async function requireEntry() {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit("transactions", me.role) ? me : null;
}

async function requireChanger() {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit("voucher_changes", me.role) ? me : null;
}

async function requireDeleter() {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit("voucher_delete", me.role) ? me : null;
}

type DbError = { code?: string; message?: string } | null;

// Rules written in the database raise their own readable message.
function explain(error: NonNullable<DbError>): string {
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return text.notAllowed;
  return text.failed;
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// Save a new voucher, or edit one (Chief Accountant only, with a reason).
// The database assigns the number, writes every row in one step and refuses a
// ledger that the voucher type does not allow.
export async function saveVoucher(
  _previous: VoucherResult,
  formData: FormData,
): Promise<VoucherResult> {
  const me = await requireEntry();
  if (!me) return { error: text.notAllowed };

  let entries: unknown;
  try {
    entries = JSON.parse(field(formData, "entries"));
  } catch {
    return { error: text.badRows };
  }

  const parsed = voucherSchema.safeParse({
    voucherId: field(formData, "voucherId"),
    typeId: field(formData, "typeId"),
    date: field(formData, "date"),
    reference: field(formData, "reference"),
    narration: field(formData, "narration"),
    reason: field(formData, "reason"),
    entries,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  const data = parsed.data;
  if (data.voucherId !== null) {
    if (!(await requireChanger())) return { error: text.notAllowed };
    if (data.reason === "") return { error: text.needReason };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_voucher", {
    p_id: data.voucherId,
    p_type: data.typeId,
    p_date: data.date,
    p_reference: data.reference,
    p_narration: data.narration,
    p_reason: data.reason === "" ? null : data.reason,
    p_entries: data.entries,
  });
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}

export async function voidVoucher(
  _previous: VoucherResult,
  formData: FormData,
): Promise<VoucherResult> {
  if (!(await requireChanger())) return { error: text.notAllowed };

  const parsed = voidSchema.safeParse({
    id: field(formData, "id"),
    reason: field(formData, "reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_voucher", {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}

// Permanent delete, System Admin only, for development. The audit log keeps
// the old values. The typed reference must match.
export async function deleteVoucher(
  _previous: VoucherResult,
  formData: FormData,
): Promise<VoucherResult> {
  if (!(await requireDeleter())) return { error: text.notAllowed };

  const id = field(formData, "id");
  if (!idSchema.safeParse(id).success) return { error: text.notFound };

  const supabase = await createClient();
  const { data: summary } = await supabase
    .from("voucher_summaries")
    .select("reference_no")
    .eq("id", id)
    .maybeSingle();
  if (!summary) return { error: text.notFound };
  if (field(formData, "confirmReference").trim() !== String(summary.reference_no)) {
    return { error: text.referenceMismatch };
  }

  const { error } = await supabase.rpc("delete_voucher", { p_id: id });
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}

// Balances of the picked ledgers as on the voucher date. The voucher being
// edited is left out so its own rows do not count twice.
export async function getLedgerBalances(
  date: string,
  ledgerIds: string[],
  excludeVoucherId: string,
): Promise<BalancesResult> {
  const me = await getCurrentUser();
  if (!me || !canView("transactions", me.role)) return { error: text.notAllowed };

  const parsed = balanceRequestSchema.safeParse({ date, ledgerIds, excludeVoucherId });
  if (!parsed.success) return { error: text.failed };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ledger_balances", {
    p_date: parsed.data.date,
    p_ledger_ids: parsed.data.ledgerIds,
    p_exclude: parsed.data.excludeVoucherId,
  });
  if (error) return { error: text.failed };

  const balances: Record<string, { amountText: string; side: "dr" | "cr" | null }> = {};
  for (const row of (data ?? []) as {
    ledger_id: string;
    amount_text: string;
    side: "dr" | "cr" | null;
  }[]) {
    balances[row.ledger_id] = { amountText: row.amount_text, side: row.side };
  }
  return { error: null, balances };
}

// The rows of one voucher, for the View and Edit dialogs.
export async function loadVoucherEntries(voucherId: string): Promise<EntriesResult> {
  const me = await getCurrentUser();
  if (!me || !canView("transactions", me.role)) return { error: text.notAllowed };
  if (!idSchema.safeParse(voucherId).success) return { error: text.notFound };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voucher_entry_details")
    .select("line_no, debit_ledger_id, debit_name, credit_ledger_id, credit_name, amount_text")
    .eq("voucher_id", voucherId)
    .order("line_no");
  if (error) return { error: text.failed };

  return {
    error: null,
    entries: (data ?? []).map((row) => ({
      debitLedgerId: row.debit_ledger_id as string,
      creditLedgerId: row.credit_ledger_id as string,
      debitName: row.debit_name as string,
      creditName: row.credit_name as string,
      amountText: row.amount_text as string,
    })),
  };
}

// Saves the date new vouchers start on. Called the moment a date is picked.
export async function setTransactionDate(value: string): Promise<VoucherResult> {
  const me = await requireEntry();
  if (!me) return { error: text.notAllowed };

  const parsed = transactionDateSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const supabase = await createClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: me.id,
      transaction_date: parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: text.failed };

  revalidatePath("/", "layout");
  return { error: null };
}
