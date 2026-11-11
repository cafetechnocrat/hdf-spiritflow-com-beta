import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/auth/roles";

export type UserRow = {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  status: "active" | "inactive";
  // Email for office staff. Cashiers have an internal address that is not shown.
  signIn: string;
};

type ProfileRecord = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
};

const CASHIER_DOMAIN = "@cashier.internal";

function toRow(profile: ProfileRecord, email: string | undefined): UserRow | null {
  if (!isRole(profile.role)) return null;
  const address = email ?? "";
  return {
    id: profile.id,
    fullName: profile.full_name,
    phone: profile.phone ?? "",
    role: profile.role,
    status: profile.status === "active" ? "active" : "inactive",
    signIn: address.endsWith(CASHIER_DOMAIN)
      ? address.slice(0, -CASHIER_DOMAIN.length)
      : address,
  };
}

// Profiles come through the signed in user, so Row Level Security decides who
// may read them. Emails live in Supabase Auth, which only the service role can
// list, so the caller must already have checked the viewer's role.
export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, status")
    .order("full_name");

  if (!profiles) return [];

  const admin = createAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map(
    (authList?.users ?? []).map((user) => [user.id, user.email]),
  );

  return (profiles as ProfileRecord[])
    .map((profile) => toRow(profile, emails.get(profile.id)))
    .filter((row): row is UserRow => row !== null);
}

export async function getUser(id: string): Promise<UserRow | null> {
  // Reject anything that is not a UUID before it reaches the database.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, status")
    .eq("id", id)
    .maybeSingle();

  if (!profile) return null;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  return toRow(profile as ProfileRecord, authUser?.user?.email);
}
