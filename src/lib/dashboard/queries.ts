import "server-only";
import { cache } from "react";
import { parseAmountToPaise, parseSignedPaise, sumPaise } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";

const ZERO = BigInt(0);

// ---------------------------------------------------------------------------
// Dates

// The months from the one holding `from` to the one holding `to`, as YYYY-MM.
export function monthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

// The same date a number of years earlier. 29 February becomes 28 February.
export function shiftYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4)) + years;
  const month = date.slice(5, 7);
  let day = date.slice(8, 10);
  if (month === "02" && day === "29") day = "28";
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Figures from the database. Each is cached for the length of one request, so
// two sections that need the same figures ask the database once.

export type MonthRow = { month: string; income: bigint; expense: bigint };

export const loadMonthly = cache(async (from: string, to: string): Promise<MonthRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_monthly", { p_from: from, p_to: to });
  if (error) throw new Error("monthly");
  return ((data ?? []) as { month_start: string; income_text: string; expense_text: string }[]).map(
    (row) => ({
      month: row.month_start.slice(0, 7),
      income: parseAmountToPaise(row.income_text) ?? parseSignedPaise(row.income_text),
      expense: parseAmountToPaise(row.expense_text) ?? parseSignedPaise(row.expense_text),
    }),
  );
});

export type RegisterRow = { month: string; ledgerId: string; ledgerName: string; amount: bigint };

export const loadRegisterMonthly = cache(
  async (kind: "sales" | "purchase", from: string, to: string): Promise<RegisterRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("dashboard_register_monthly", {
      p_kind: kind,
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error("register");
    return (
      (data ?? []) as {
        month_start: string;
        ledger_id: string;
        ledger_name: string;
        amount_text: string;
      }[]
    ).map((row) => ({
      month: row.month_start.slice(0, 7),
      ledgerId: row.ledger_id,
      ledgerName: row.ledger_name,
      amount: parseSignedPaise(row.amount_text),
    }));
  },
);

export type PositionKind = "cash_bank" | "receivable" | "payable";
export type PositionRow = { kind: PositionKind; ledgerId: string; name: string; net: bigint };

export const loadPositions = cache(async (asOn: string): Promise<PositionRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_positions", { p_as_on: asOn });
  if (error) throw new Error("positions");
  return (
    (data ?? []) as { kind: PositionKind; ledger_id: string; ledger_name: string; net_text: string }[]
  ).map((row) => ({
    kind: row.kind,
    ledgerId: row.ledger_id,
    name: row.ledger_name,
    net: parseSignedPaise(row.net_text),
  }));
});

export type LatestVoucher = {
  id: string;
  typeName: string;
  referenceNo: string;
  date: string;
  details: string;
  totalText: string;
};

export async function loadLatestVouchers(): Promise<LatestVoucher[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voucher_summaries")
    .select("id, type_name, reference_no, voucher_date, debit_names, credit_names, total_text")
    .eq("status", "posted")
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw new Error("latest");
  return (
    (data ?? []) as {
      id: string;
      type_name: string;
      reference_no: string;
      voucher_date: string;
      debit_names: string | null;
      credit_names: string | null;
      total_text: string;
    }[]
  ).map((row) => ({
    id: row.id,
    typeName: row.type_name,
    referenceNo: row.reference_no,
    date: row.voucher_date,
    details: [row.debit_names, row.credit_names].filter(Boolean).join(" to "),
    totalText: row.total_text,
  }));
}

export type BooksCheck = {
  // Debit and credit totals as on today, in paise. Null when the user cannot see reports.
  difference: bigint | null;
  enteredToday: number;
  latestTime: string | null;
  voidThisMonth: number;
};

// India has no daylight saving, so midnight there is a fixed offset.
const IST = "+05:30";

export async function loadBooksCheck(today: string, includeBalance: boolean): Promise<BooksCheck> {
  const supabase = await createClient();

  let difference: bigint | null = null;
  if (includeBalance) {
    const { data, error } = await supabase.rpc("report_ledger_nets", {
      p_from: null,
      p_to: today,
      p_with_opening: true,
    });
    if (error) throw new Error("books");
    let debit = ZERO;
    let credit = ZERO;
    for (const row of (data ?? []) as { net_text: string }[]) {
      const net = parseSignedPaise(row.net_text);
      if (net > ZERO) debit += net;
      else credit += -net;
    }
    difference = debit > credit ? debit - credit : credit - debit;
  }

  const [entered, latest, voided] = await Promise.all([
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .gte("created_at", `${today}T00:00:00${IST}`),
    supabase
      .from("vouchers")
      .select("created_at")
      .eq("status", "posted")
      .gte("created_at", `${today}T00:00:00${IST}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("status", "void")
      .gte("voided_at", `${today.slice(0, 7)}-01T00:00:00${IST}`),
  ]);

  const latestAt = latest.data?.created_at as string | undefined;
  return {
    difference,
    enteredToday: entered.count ?? 0,
    latestTime: latestAt
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(latestAt))
      : null,
    voidThisMonth: voided.count ?? 0,
  };
}

export type SystemSnapshot = { activeUsers: number; activeRoles: number; customAccess: number };

export async function loadSystemSnapshot(): Promise<SystemSnapshot> {
  const supabase = await createClient();
  const [users, roles, custom] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("roles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("user_access").select("user_id"),
  ]);
  const customIds = new Set(((custom.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  return {
    activeUsers: users.count ?? 0,
    activeRoles: roles.count ?? 0,
    customAccess: customIds.size,
  };
}

// ---------------------------------------------------------------------------
// Small sums shared by the sections

export function totalOf(rows: RegisterRow[]): bigint {
  return sumPaise(rows.map((row) => row.amount));
}

export function byMonth(rows: RegisterRow[], months: string[]): bigint[] {
  return months.map((month) =>
    sumPaise(rows.filter((row) => row.month === month).map((row) => row.amount)),
  );
}
