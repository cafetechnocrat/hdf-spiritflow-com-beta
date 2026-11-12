import "server-only";
import { cache } from "react";
import { parseAmountToPaise, parseSignedPaise, sumPaise } from "@/lib/format/money";
import type { DashboardFeature } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

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

// Every figure asks for the lock of the card that shows it. The database checks
// that lock, so a locked person gets nothing back.
export const loadMonthly = cache(
  async (
    feature: DashboardFeature,
    from: string,
    to: string,
    tradingOnly: boolean,
  ): Promise<MonthRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("dashboard_monthly", {
      p_feature: feature,
      p_from: from,
      p_to: to,
      p_trading_only: tradingOnly,
    });
    if (error) throw new Error("monthly");
    return (
      (data ?? []) as { month_start: string; income_text: string; expense_text: string }[]
    ).map((row) => ({
      month: row.month_start.slice(0, 7),
      income: parseAmountToPaise(row.income_text) ?? parseSignedPaise(row.income_text),
      expense: parseAmountToPaise(row.expense_text) ?? parseSignedPaise(row.expense_text),
    }));
  },
);

export type RegisterRow = { month: string; ledgerId: string; ledgerName: string; amount: bigint };

export const loadRegisterMonthly = cache(
  async (
    feature: DashboardFeature,
    kind: "sales" | "purchase",
    from: string,
    to: string,
  ): Promise<RegisterRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("dashboard_register_monthly", {
      p_feature: feature,
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
export type PositionRow = { ledgerId: string; name: string; net: bigint };

export const loadPositions = cache(
  async (feature: DashboardFeature, kind: PositionKind, asOn: string): Promise<PositionRow[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("dashboard_positions", {
      p_feature: feature,
      p_kind: kind,
      p_as_on: asOn,
    });
    if (error) throw new Error("positions");
    return ((data ?? []) as { ledger_id: string; ledger_name: string; net_text: string }[]).map(
      (row) => ({
        ledgerId: row.ledger_id,
        name: row.ledger_name,
        net: parseSignedPaise(row.net_text),
      }),
    );
  },
);

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
  const { data, error } = await supabase.rpc("dashboard_latest_vouchers", { p_limit: 6 });
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
  // The gap between debit and credit totals as on today, in paise.
  difference: bigint;
  enteredToday: number;
  latestTime: string | null;
  voidThisMonth: number;
};

// India has no daylight saving, so midnight there is a fixed offset.
const IST = "+05:30";

export async function loadBooksCheck(today: string): Promise<BooksCheck> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_books_check", {
    p_today: today,
    p_day_start: `${today}T00:00:00${IST}`,
    p_month_start: `${today.slice(0, 7)}-01T00:00:00${IST}`,
  });
  if (error) throw new Error("books");
  const row = ((data ?? []) as {
    difference_text: string;
    entered_today: number;
    latest_at: string | null;
    void_month: number;
  }[])[0];
  if (!row) throw new Error("books");

  return {
    difference: parseAmountToPaise(row.difference_text) ?? parseSignedPaise(row.difference_text),
    enteredToday: row.entered_today,
    latestTime: row.latest_at
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(row.latest_at))
      : null,
    voidThisMonth: row.void_month,
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
