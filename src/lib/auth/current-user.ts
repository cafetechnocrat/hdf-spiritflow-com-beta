import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AccessMap } from "./permissions";

// What the user still has to do for two-factor.
// off: not needed. setup: no authenticator yet. verify: enter the code.
// ok: already verified in this session.
export type TwoFactorState = "off" | "setup" | "verify" | "ok";

export type CurrentUser = {
  id: string;
  fullName: string;
  roleId: string;
  roleName: string;
  // The System Admin role has every right and can manage roles and access.
  isSystemAdmin: boolean;
  // What the user's role may do, by feature. Loaded from the database.
  access: AccessMap;
  email: string;
  // True until the user replaces a temporary password.
  mustChangePassword: boolean;
  twoFactor: TwoFactorState;
};

type RoleRecord = {
  id: string;
  name: string;
  is_active: boolean;
  is_system: boolean;
  requires_two_factor: boolean;
};

// Returns the signed in user with an active profile and an active role, or null.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // The session check depends on the current time, so wait for a real request.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, status, must_change_password, roles(id, name, is_active, is_system, requires_two_factor)",
    )
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;

  const embedded = profile.roles as unknown as RoleRecord | RoleRecord[] | null;
  const role = Array.isArray(embedded) ? embedded[0] : embedded;
  // A role that is switched off cannot sign in.
  if (!role || !role.is_active) return null;

  // Two-factor is a setting on the role.
  let twoFactor: TwoFactorState = "off";
  if (role.requires_two_factor) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel === "aal2") {
      twoFactor = "ok";
    } else {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      // `totp` lists only verified authenticator factors.
      twoFactor = factors?.totp?.length ? "verify" : "setup";
    }
  }

  // The System Admin role has every right on every feature. Other roles get
  // exactly what is ticked for them.
  const access: AccessMap = {};
  if (role.is_system) {
    const { data: features } = await supabase.from("features").select("key");
    for (const feature of (features ?? []) as { key: string }[]) {
      access[feature.key] = { view: true, edit: true, delete: true };
    }
  } else {
    const { data: rows } = await supabase
      .from("role_access")
      .select("feature_key, can_view, can_edit, can_delete")
      .eq("role_id", role.id);
    for (const row of (rows ?? []) as {
      feature_key: string;
      can_view: boolean;
      can_edit: boolean;
      can_delete: boolean;
    }[]) {
      access[row.feature_key] = {
        view: row.can_view,
        edit: row.can_edit,
        delete: row.can_delete,
      };
    }
  }

  return {
    id: auth.user.id,
    fullName: profile.full_name,
    roleId: role.id,
    roleName: role.name,
    isSystemAdmin: role.is_system,
    access,
    email: auth.user.email ?? "",
    mustChangePassword: profile.must_change_password === true,
    twoFactor,
  };
});
