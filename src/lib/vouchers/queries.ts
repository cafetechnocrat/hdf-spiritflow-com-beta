import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadTransactionDate, todayInIndia } from "./transaction-date";
import type {
  LedgerChoice,
  VoucherData,
  VoucherRow,
  VoucherStatus,
  VoucherTypeRow,
} from "./types";

// How many of the newest vouchers the list holds. The Day Book report will
// cover the full history with date ranges.
const LIST_LIMIT = 500;

type TypeRecord = {
  id: string;
  code: string;
  name: string;
  debit_label: string;
  credit_label: string;
};

type RuleRecord = { voucher_type_id: string; side: "dr" | "cr"; group_id: string };
type GroupRecord = { id: string; parent_id: string | null };
type LedgerRecord = { id: string; name: string; group_id: string };

type SummaryRecord = {
  id: string;
  voucher_type_id: string;
  type_name: string;
  reference_no: string;
  voucher_date: string;
  reference: string | null;
  narration: string | null;
  status: VoucherStatus;
  edit_reason: string | null;
  void_reason: string | null;
  total_text: string;
  debit_names: string | null;
  credit_names: string | null;
};

// A rule names a group. Everything under that group is allowed too.
function expandGroups(roots: string[], children: Map<string, string[]>): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of children.get(id) ?? []) queue.push(child);
  }
  return [...seen];
}

// Types, rules, ledgers and vouchers all come from the database. Row Level
// Security decides who may read them.
export async function loadVoucherData(userId: string): Promise<VoucherData> {
  const supabase = await createClient();
  const [typesResult, rulesResult, groupsResult, ledgersResult, vouchersResult, transactionDate] =
    await Promise.all([
      supabase
        .from("voucher_types")
        .select("id, code, name, debit_label, credit_label")
        .eq("status", "active")
        .order("sort_order")
        .order("name"),
      supabase.from("voucher_type_rules").select("voucher_type_id, side, group_id"),
      supabase.from("ledger_groups").select("id, parent_id"),
      supabase
        .from("ledgers")
        .select("id, name, group_id")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("voucher_summaries")
        .select(
          "id, voucher_type_id, type_name, reference_no, voucher_date, reference, narration, status, edit_reason, void_reason, total_text, debit_names, credit_names",
        )
        .order("voucher_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT + 1),
      loadTransactionDate(userId),
    ]);

  const children = new Map<string, string[]>();
  for (const group of (groupsResult.data ?? []) as GroupRecord[]) {
    if (!group.parent_id) continue;
    const list = children.get(group.parent_id) ?? [];
    list.push(group.id);
    children.set(group.parent_id, list);
  }

  const rules = (rulesResult.data ?? []) as RuleRecord[];
  const types: VoucherTypeRow[] = ((typesResult.data ?? []) as TypeRecord[]).map((t) => {
    const roots = (side: "dr" | "cr") =>
      rules.filter((r) => r.voucher_type_id === t.id && r.side === side).map((r) => r.group_id);
    const debitRoots = roots("dr");
    const creditRoots = roots("cr");
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      debitLabel: t.debit_label,
      creditLabel: t.credit_label,
      debitGroupIds: debitRoots.length === 0 ? null : expandGroups(debitRoots, children),
      creditGroupIds: creditRoots.length === 0 ? null : expandGroups(creditRoots, children),
    };
  });

  const ledgers: LedgerChoice[] = ((ledgersResult.data ?? []) as LedgerRecord[]).map((l) => ({
    id: l.id,
    name: l.name,
    groupId: l.group_id,
  }));

  const summaries = (vouchersResult.data ?? []) as SummaryRecord[];
  const truncated = summaries.length > LIST_LIMIT;
  const vouchers: VoucherRow[] = summaries.slice(0, LIST_LIMIT).map((v) => ({
    id: v.id,
    voucherTypeId: v.voucher_type_id,
    typeName: v.type_name,
    referenceNo: v.reference_no,
    date: v.voucher_date,
    reference: v.reference,
    narration: v.narration,
    status: v.status,
    editReason: v.edit_reason,
    voidReason: v.void_reason,
    totalText: v.total_text,
    debitNames: v.debit_names ?? "",
    creditNames: v.credit_names ?? "",
  }));

  return {
    types,
    ledgers,
    vouchers,
    truncated,
    transactionDate,
    today: todayInIndia(),
  };
}
