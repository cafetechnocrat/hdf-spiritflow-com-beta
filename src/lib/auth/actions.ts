"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KEEP_COOKIE, KEEP_SECONDS } from "@/lib/supabase/session-cookies";
import { logAuthEvent } from "./audit";
import { emailSignInSchema } from "./schemas";

export type SignInState = {
  error: string | null;
  email: string;
};

// One message for every failure, so it never shows which part was wrong.
const GENERIC_ERROR = "The email or password is not correct.";

export async function signInWithEmail(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = emailSignInSchema.safeParse({
    email: rawEmail,
    password: String(formData.get("password") ?? ""),
    keep: formData.get("keep") === "on",
  });

  if (!parsed.success) {
    return { error: GENERIC_ERROR, email: rawEmail };
  }

  const { email, password, keep } = parsed.data;
  const cookieStore = await cookies();

  if (keep) {
    cookieStore.set(KEEP_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: KEEP_SECONDS,
    });
  } else {
    cookieStore.delete(KEEP_COOKIE);
  }

  const supabase = await createClient({ keepSignedIn: keep });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await logAuthEvent("failed_login", { data: { email } });
    return { error: GENERIC_ERROR, email };
  }

  // The account must have an active profile, even when the password is right.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    await logAuthEvent("failed_login", {
      actorId: data.user.id,
      data: { email, reason: "no active profile" },
    });
    return { error: GENERIC_ERROR, email };
  }

  await logAuthEvent("login", { actorId: data.user.id });
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (data.user) await logAuthEvent("logout", { actorId: data.user.id });
  (await cookies()).delete(KEEP_COOKIE);
  redirect("/login");
}
