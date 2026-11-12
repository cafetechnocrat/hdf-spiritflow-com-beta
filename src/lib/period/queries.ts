import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/vouchers/transaction-date";
import { buildPeriod, financialYearOf, type Period } from "./financial-year";

// The financial year for one user: the one they picked, or the current one.
// The list of years starts with the year that holds the books begin date,
// a setting in the database, and ends with the current year.
export async function loadPeriod(userId: string): Promise<Period> {
  const supabase = await createClient();
  const [settingResult, preferenceResult] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "books_begin_date").maybeSingle(),
    supabase.from("user_preferences").select("fy_start_year").eq("user_id", userId).maybeSingle(),
  ]);

  const current = financialYearOf(todayInIndia());
  const begin = settingResult.data?.value
    ? financialYearOf(String(settingResult.data.value))
    : current;
  const first = Math.min(begin, current);

  const years: number[] = [];
  for (let year = first; year <= current; year += 1) years.push(year);

  const picked = preferenceResult.data?.fy_start_year as number | null | undefined;
  const selected = picked !== null && picked !== undefined && years.includes(picked) ? picked : current;
  return buildPeriod(selected, current, years);
}
