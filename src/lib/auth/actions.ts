"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { KEEP_COOKIE, KEEP_SECONDS } from "@/lib/supabase/session-cookies";
import { logAuthEvent } from "./audit";
import { changePasswordSchema, emailSignInSchema } from "./schemas";

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

export type ChangePasswordState = { error: string | null; done?: boolean };

// Replaces the user's password. Used for the forced change after a temporary
// password and for a voluntary change. The current password is checked first.
export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save." };
  }

  // Check the current password by signing in again with it.
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.current,
  });
  if (checkError) {
    return { error: "The current password is not correct." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.next,
  });
  if (updateError) {
    return { error: "Could not save the new password. Try a different one." };
  }

  // The flag is cleared with the service role: users cannot edit profiles.
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", auth.user.id);

  await logAuthEvent("password_change", { actorId: auth.user.id });
  // Forget pages the browser kept from before the change, so the app does not
  // send the person back here. The screen then opens the dashboard itself.
  revalidatePath("/", "layout");
  return { error: null, done: true };
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (data.user) await logAuthEvent("logout", { actorId: data.user.id });
  (await cookies()).delete(KEEP_COOKIE);
  redirect("/login");
}
