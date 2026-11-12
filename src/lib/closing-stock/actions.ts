"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { parseAmountToPaise, parseSignedPaise } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import type { PreviewResult, SaveResult } from "./types";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  badValue: "Enter the closing stock value as an amount, like 452000.50.",
  badDate: "Choose the date from the calendar.",
} as const;

const input = z.object({
  accountId: z.uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`))),
  value: z.string().trim(),
  note: z.string().trim().max(300, "The note is too long."),
  reason: z.string().trim().max(300, "The reason is too long."),
});

type Plan = {
  stock_date: string;
  value: string;
  diff: string;
  current_diff: string;
  is_target: boolean;
};

// Paise back to signed text such as -18000.00.
function paiseToText(paise: bigint): string {
  const negative = paise < BigInt(0);
  const absolute = (negative ? -paise : paise).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${absolute.slice(0, -2)}.${absolute.slice(-2)}`;
}

function explain(error: { code?: string; message?: string }): string {
  // Rules written in the database raise their own readable message.
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return text.notAllowed;
  return text.failed;
}

// Shows what saving a value would do: the change for the day, and any later day
// whose journal would move. Changes nothing.
export async function previewClosingStock(raw: {
  accountId: string;
  date: string;
  value: string;
}): Promise<PreviewResult> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !canView(me, "closing_stock")) {
    return { ok: false, error: text.notAllowed };
  }
  const parsed = input.pick({ accountId: true, date: true, value: true }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: text.badDate };
  const paise = parseAmountToPaise(parsed.data.value);
  if (paise === null) return { ok: false, error: text.badValue };

  const supabase = await createClient();
  const [plan, existing] = await Promise.all([
    supabase.rpc("closing_stock_plan", {
      p_account: parsed.data.accountId,
      p_date: parsed.data.date,
      p_value: parsed.data.value.replace(/,/g, ""),
    }),
    supabase
      .from("closing_stocks")
      .select("id", { count: "exact", head: true })
      .eq("stock_account_id", parsed.data.accountId)
      .eq("stock_date", parsed.data.date),
  ]);
  if (plan.error) return { ok: false, error: explain(plan.error) };

  const rows = (plan.data ?? []) as Plan[];
  const target = rows.find((row) => row.is_target);
  if (!target) return { ok: false, error: text.failed };
  return {
    ok: true,
    bookBefore: paiseToText(paise - parseSignedPaise(target.diff)),
    diff: target.diff,
    existing: (existing.count ?? 0) > 0,
    later: rows
      .filter((row) => !row.is_target && row.diff !== row.current_diff)
      .map((row) => ({ date: row.stock_date, from: row.current_diff, to: row.diff })),
  };
}

// Saves the closing stock for a day and posts or updates its journal. Later days
// are worked out again by the database in the same step.
export async function saveClosingStock(raw: {
  accountId: string;
  date: string;
  value: string;
  note: string;
  reason: string;
}): Promise<SaveResult> {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword || !canEdit(me, "closing_stock")) {
    return { error: text.notAllowed };
  }
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }
  if (parseAmountToPaise(parsed.data.value) === null) return { error: text.badValue };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_closing_stock", {
    p_account: parsed.data.accountId,
    p_date: parsed.data.date,
    p_value: parsed.data.value.replace(/,/g, ""),
    p_note: parsed.data.note,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: explain(error) };

  revalidatePath("/closing-stock");
  return { error: null };
}
