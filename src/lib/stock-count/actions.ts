"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  loadPastCounts,
  loadPostAccount,
  loadPostPreview,
  loadValueSummary,
} from "./queries";
import type {
  CountResult,
  PastCount,
  PastFilters,
  PostPreview,
  SaveResult,
  ValueLine,
} from "./types";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  badInput: "That entry is not valid.",
  noAccount: "No stock account is set up for closing stock.",
} as const;

const PATH = "/stock-count";

const id = z.uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const name = z.string().trim().max(100);

type DbError = { code?: string; message?: string } | null;

// A rule written in the database raises its own readable message.
function explain(error: NonNullable<DbError>): string {
  if (error.code === "42501") return text.notAllowed;
  if (error.code === "P0001" && error.message) return error.message;
  return text.failed;
}

async function me() {
  const user = await getCurrentUser();
  return user && !user.mustChangePassword ? user : null;
}

// Saves one item's entry as the person leaves its box. Blank means not entered.
export async function saveLine(raw: {
  pointId: string;
  date: string;
  itemId: string;
  bottles: string;
  pegs: string;
  countedBy: string;
}): Promise<CountResult> {
  const user = await me();
  if (!user || !canEdit(user, "stock_count")) return { error: text.notAllowed };

  const parsed = z
    .object({
      pointId: id,
      date,
      itemId: id,
      bottles: z.string().trim().regex(/^\d{0,6}$/),
      pegs: z.string().trim().regex(/^\d{0,4}(\.\d{0,2})?$/),
      countedBy: name,
    })
    .safeParse(raw);
  if (!parsed.success) return { error: text.badInput };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("stock_count_set_line", {
    p_point: v.pointId,
    p_date: v.date,
    p_item: v.itemId,
    p_bottles: v.bottles === "" ? null : Number(v.bottles),
    p_pegs: v.pegs === "" || v.pegs === "." ? null : Number(v.pegs),
    p_by: v.countedBy || null,
  });
  if (error) return { error: explain(error) };
  return { error: null };
}

// The Save button. Returns how many items are still blank, or that the count is saved.
export async function saveCount(raw: {
  pointId: string;
  date: string;
  countedBy: string;
}): Promise<SaveResult> {
  const user = await me();
  if (!user || !canEdit(user, "stock_count_save")) return { error: text.notAllowed };
  const parsed = z.object({ pointId: id, date, countedBy: name }).safeParse(raw);
  if (!parsed.success) return { error: text.badInput };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_stock_count", {
    p_point: parsed.data.pointId,
    p_date: parsed.data.date,
    p_by: parsed.data.countedBy || null,
  });
  if (error) return { error: explain(error) };
  const result = ((data ?? []) as { missing: number; saved: boolean }[])[0];
  if (!result) return { error: text.failed };
  revalidatePath(PATH);
  return { error: null, missing: result.missing, saved: result.saved };
}

// The Stock Value panel. Only for a person with the View Stock Value right.
export async function fetchValues(forDate: string): Promise<ValueLine[]> {
  const user = await me();
  if (!user || !canView(user, "stock_count_value") || !date.safeParse(forDate).success) return [];
  return loadValueSummary(forDate).catch(() => []);
}

export async function fetchPastCounts(filters: PastFilters): Promise<PastCount[] | null> {
  const user = await me();
  if (!user || !canView(user, "stock_count")) return null;
  const parsed = z
    .object({
      from: date,
      to: date,
      pointId: z.union([id, z.literal("")]),
      status: z.enum(["", "draft", "complete"]),
    })
    .safeParse(filters);
  if (!parsed.success) return null;
  return loadPastCounts(parsed.data).catch(() => null);
}

export type PreviewResult = { error: string | null; preview: PostPreview | null };

// What posting would do, for the confirmation dialog.
export async function previewPost(forDate: string): Promise<PreviewResult> {
  const user = await me();
  if (!user || !canEdit(user, "stock_count_post") || !canView(user, "stock_count_value")) {
    return { error: text.notAllowed, preview: null };
  }
  if (!date.safeParse(forDate).success) return { error: text.badInput, preview: null };
  const account = await loadPostAccount();
  if (!account) return { error: text.noAccount, preview: null };
  try {
    return { error: null, preview: await loadPostPreview(account, forDate) };
  } catch {
    return { error: text.failed, preview: null };
  }
}

export type PostResult = { error: string | null; total: string | null };

// Posts the total closing stock value for the date to the Closing Stock screen.
export async function postClosing(forDate: string, reason: string): Promise<PostResult> {
  const user = await me();
  if (!user || !canEdit(user, "stock_count_post")) return { error: text.notAllowed, total: null };
  const parsed = z.object({ forDate: date, reason: z.string().trim().max(300) }).safeParse({
    forDate,
    reason,
  });
  if (!parsed.success) return { error: text.badInput, total: null };
  const account = await loadPostAccount();
  if (!account) return { error: text.noAccount, total: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_stock_count_closing", {
    p_account: account,
    p_date: parsed.data.forDate,
    p_reason: parsed.data.reason || null,
  });
  if (error) return { error: explain(error), total: null };
  revalidatePath(PATH);
  revalidatePath("/closing-stock");
  revalidatePath("/");
  return { error: null, total: Number(data ?? 0).toFixed(2) };
}
