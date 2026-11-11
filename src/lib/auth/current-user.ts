import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABELS = {
  md: "Managing Director",
  system_admin: "System Admin",
  chief_accountant: "Chief Accountant",
  accounts_staff: "Accounts Staff",
  night_accountant: "Night Accountant",
  cashier: "Cashier",
  stock_keeper: "Stock Keeper",
  security: "Security",
  kitchen_staff: "Kitchen Staff",
} as const;

export type Role = keyof typeof ROLE_LABELS;

export type CurrentUser = {
  id: string;
  fullName: string;
  role: Role;
};

// Returns the signed in user with an active profile, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // The session check depends on the current time, so wait for a real request.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;

  return {
    id: auth.user.id,
    fullName: profile.full_name,
    role: profile.role as Role,
  };
}
