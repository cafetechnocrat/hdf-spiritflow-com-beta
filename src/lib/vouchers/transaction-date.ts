import "server-only";
import { createClient } from "@/lib/supabase/server";

// Today's date in India as YYYY-MM-DD. The timezone is the business timezone.
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// The date new vouchers start on for this user: the one they chose, or today.
// Row Level Security limits the read to the user's own row.
export async function loadTransactionDate(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("transaction_date")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.transaction_date as string | null | undefined) ?? todayInIndia();
}
