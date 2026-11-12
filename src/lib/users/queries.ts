import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A role as the user screens need it. Roles come from the database.
export type RoleOption = {
  id: string;
  name: string;
  signInMethod: "email" | "pin";
  requiresTwoFactor: boolean;
};

export type UserRow = {
  id: string;
  fullName: string;
  phone: string;
  roleId: string;
  roleName: string;
  requiresTwoFactor: boolean;
  signInMethod: "email" | "pin";
  // True when the person has less access than their role.
  customAccess: boolean;
  status: "active" | "inactive";
  // Email for office staff. Cashiers have an internal address that is not shown.
  signIn: string;
};

type ProfileRecord = {
  id: string;
  full_name: string;
  phone: string | null;
  role_id: string;
  status: string;
  roles:
    | { name: string; requires_two_factor: boolean; sign_in_method: "email" | "pin" }
    | { name: string; requires_two_factor: boolean; sign_in_method: "email" | "pin" }[]
    | null;
};

const PROFILE_COLUMNS =
  "id, full_name, phone, role_id, status, roles(name, requires_two_factor, sign_in_method)";

const CASHIER_DOMAIN = "@cashier.internal";

function toRow(
  profile: ProfileRecord,
  email: string | undefined,
  customAccess: boolean,
): UserRow | null {
  const role = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
  if (!role) return null;
  const address = email ?? "";
  return {
    id: profile.id,
    fullName: profile.full_name,
    phone: profile.phone ?? "",
    roleId: profile.role_id,
    roleName: role.name,
    requiresTwoFactor: role.requires_two_factor,
    signInMethod: role.sign_in_method,
    customAccess,
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
    .select(PROFILE_COLUMNS)
    .order("full_name");

  if (!profiles) return [];

  const admin = createAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map(
    (authList?.users ?? []).map((user) => [user.id, user.email]),
  );

  // People with a row in user_access have less than their role.
  const { data: custom } = await supabase.from("user_access").select("user_id");
  const customIds = new Set(((custom ?? []) as { user_id: string }[]).map((r) => r.user_id));

  return (profiles as ProfileRecord[])
    .map((profile) => toRow(profile, emails.get(profile.id), customIds.has(profile.id)))
    .filter((row): row is UserRow => row !== null);
}

export async function getUser(id: string): Promise<UserRow | null> {
  // Reject anything that is not a UUID before it reaches the database.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!profile) return null;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const { count } = await supabase
    .from("user_access")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id);
  return toRow(profile as ProfileRecord, authUser?.user?.email, (count ?? 0) > 0);
}

// Every role, for the filter on the users list.
export async function listRoles(): Promise<RoleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name, sign_in_method, requires_two_factor")
    .order("sort_order")
    .order("name");
  return ((data ?? []) as {
    id: string;
    name: string;
    sign_in_method: "email" | "pin";
    requires_two_factor: boolean;
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    signInMethod: r.sign_in_method,
    requiresTwoFactor: r.requires_two_factor,
  }));
}

// The roles a user can be given: active roles that sign in with email. A role
// that signs in with a PIN is added with the cashier login.
export async function listAssignableRoles(keepId?: string): Promise<RoleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name, sign_in_method, requires_two_factor, is_active")
    .order("sort_order")
    .order("name");
  return ((data ?? []) as {
    id: string;
    name: string;
    sign_in_method: "email" | "pin";
    requires_two_factor: boolean;
    is_active: boolean;
  }[])
    .filter((r) => r.id === keepId || (r.is_active && r.sign_in_method === "email"))
    .map((r) => ({
      id: r.id,
      name: r.name,
      signInMethod: r.sign_in_method,
      requiresTwoFactor: r.requires_two_factor,
    }));
}

// The id of the built-in System Admin role.
export async function getSystemRoleId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id").eq("is_system", true).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
