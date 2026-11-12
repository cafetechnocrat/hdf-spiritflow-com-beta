"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { loadPeriod } from "./queries";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  badYear: "Choose a financial year from the list.",
} as const;

export type PeriodResult = { error: string | null };

// Saves the financial year the user picked. Called the moment one is chosen.
export async function setFinancialYear(startYear: number): Promise<PeriodResult> {
  const me = await getCurrentUser();
  if (
    !me ||
    me.mustChangePassword ||
    !(canView("reports", me.role) || canEdit("transactions", me.role))
  ) {
    return { error: text.notAllowed };
  }

  // Only years in the list can be picked.
  const period = await loadPeriod(me.id);
  if (!Number.isInteger(startYear) || !period.years.includes(startYear)) {
    return { error: text.badYear };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_preferences").upsert(
    { user_id: me.id, fy_start_year: startYear, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) return { error: text.failed };

  revalidatePath("/", "layout");
  return { error: null };
}
