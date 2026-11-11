"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAuthEvent } from "./audit";

export type SetupInfo =
  | { ok: true; factorId: string; qr: string; secret: string }
  | { ok: false; error: string };

export type CodeState = { error: string | null };

const text = {
  setupFailed: "Could not start the setup. Refresh the page and try again.",
  badCode: "That code is not correct. Check the code in your app and try again.",
  badFormat: "Enter the 6-digit code.",
  noFactor: "No authenticator is set up for this account.",
} as const;

const CODE = /^\d{6}$/;

// Starts a new authenticator setup. Earlier unfinished setups are removed so
// they do not pile up.
export async function beginTwoFactorSetup(): Promise<SetupInfo> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Spirit Flow",
  });
  if (error || !data) return { ok: false, error: text.setupFailed };

  // Supabase returns the SVG as an unencoded data URI with a trailing newline,
  // which the image component rejects. Encode it properly.
  const svg = data.totp.qr_code
    .replace(/^data:image\/svg\+xml;(charset=)?utf-8,/i, "")
    .trim();

  return {
    ok: true,
    factorId: data.id,
    qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    secret: data.totp.secret,
  };
}

// Confirms the first code from the app, which finishes the setup.
export async function confirmTwoFactorSetup(
  _previous: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const code = String(formData.get("code") ?? "");
  const factorId = String(formData.get("factorId") ?? "");
  if (!CODE.test(code)) return { error: text.badFormat };
  if (!factorId) return { error: text.setupFailed };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: text.badCode };

  await logAuthEvent("mfa_enrol", { actorId: auth.user.id });
  redirect("/");
}

// Checks the code at sign in. A correct code raises the session to aal2.
export async function verifyTwoFactor(
  _previous: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const code = String(formData.get("code") ?? "");
  if (!CODE.test(code)) return { error: text.badFormat };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) return { error: text.noFactor };

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (error) {
    await logAuthEvent("failed_login", {
      actorId: auth.user.id,
      data: { reason: "wrong two-factor code" },
    });
    return { error: text.badCode };
  }
  redirect("/");
}
