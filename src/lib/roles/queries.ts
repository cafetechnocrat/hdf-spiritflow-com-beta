import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessFlags, FeatureRow, RoleAccessMap, RoleRow, RolesData, SignInMethod } from "./types";

type RoleRecord = {
  id: string;
  name: string;
  is_system: boolean;
  is_active: boolean;
  requires_two_factor: boolean;
  sign_in_method: SignInMethod;
};

type FeatureRecord = {
  key: string;
  label: string;
  group_label: string;
  offers_view: boolean;
  offers_edit: boolean;
  offers_delete: boolean;
};

type AccessRecord = {
  role_id: string;
  feature_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

// Roles, features and what each role may do. Row Level Security limits all of
// it to the System Admin.
export async function loadRolesData(): Promise<RolesData> {
  const supabase = await createClient();
  const [rolesResult, featuresResult, accessResult, profilesResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, is_system, is_active, requires_two_factor, sign_in_method")
      .order("sort_order")
      .order("name"),
    supabase
      .from("features")
      .select("key, label, group_label, offers_view, offers_edit, offers_delete")
      .order("sort_order"),
    supabase.from("role_access").select("role_id, feature_key, can_view, can_edit, can_delete"),
    supabase.from("profiles").select("role_id"),
  ]);

  const userCounts = new Map<string, number>();
  for (const profile of (profilesResult.data ?? []) as { role_id: string }[]) {
    userCounts.set(profile.role_id, (userCounts.get(profile.role_id) ?? 0) + 1);
  }

  const roles: RoleRow[] = ((rolesResult.data ?? []) as RoleRecord[]).map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.is_system,
    isActive: r.is_active,
    requiresTwoFactor: r.requires_two_factor,
    signInMethod: r.sign_in_method,
    userCount: userCounts.get(r.id) ?? 0,
  }));

  const features: FeatureRow[] = ((featuresResult.data ?? []) as FeatureRecord[]).map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group_label,
    offersView: f.offers_view,
    offersEdit: f.offers_edit,
    offersDelete: f.offers_delete,
  }));

  const access: RoleAccessMap = {};
  for (const row of (accessResult.data ?? []) as AccessRecord[]) {
    const flags: AccessFlags = { view: row.can_view, edit: row.can_edit, delete: row.can_delete };
    (access[row.role_id] ??= {})[row.feature_key] = flags;
  }

  return { roles, features, access };
}
