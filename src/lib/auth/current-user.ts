import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

import { TWO_FACTOR_ROLES, type Role } from "./roles";

// What the user still has to do for two-factor.
// off: not needed. setup: no authenticator yet. verify: enter the code.
// ok: already verified in this session.
export type TwoFactorState = "off" | "setup" | "verify" | "ok";

export type CurrentUser = {
  id: string;
  fullName: string;
  role: Role;
  email: string;
  // True until the user replaces a temporary password.
  mustChangePassword: boolean;
  twoFactor: TwoFactorState;
};

// Returns the signed in user with an active profile, or null.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // The session check depends on the current time, so wait for a real request.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status, must_change_password")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") return null;

  const role = profile.role as Role;
  let twoFactor: TwoFactorState = "off";
  if (TWO_FACTOR_ROLES.includes(role)) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel === "aal2") {
      twoFactor = "ok";
    } else {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      // `totp` lists only verified authenticator factors.
      twoFactor = factors?.totp?.length ? "verify" : "setup";
    }
  }

  return {
    id: auth.user.id,
    fullName: profile.full_name,
    role,
    email: auth.user.email ?? "",
    mustChangePassword: profile.must_change_password === true,
    twoFactor,
  };
});
