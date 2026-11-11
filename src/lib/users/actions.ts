"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createUserSchema,
  editUserSchema,
  statusSchema,
  type UserFormState,
} from "./schemas";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  emailTaken: "A user with this email already exists.",
  notFound: "That user was not found.",
  ownRole: "You cannot change your own role.",
  ownStatus: "You cannot deactivate your own account.",
  lastAdmin: "There must always be at least one active System Admin.",
  ownDelete: "You cannot delete your own account.",
  deactivateFirst: "Deactivate the user before deleting them.",
  nameMismatch: "The name you typed does not match. Nothing was deleted.",
} as const;

// Only the System Admin may change users. The database enforces the same rule
// through Row Level Security, so this check is the first gate, not the only one.
async function requireAdmin() {
  const me = await getCurrentUser();
  return me && canEdit("users", me.role) ? me : null;
}

async function otherActiveAdmins(excludeId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "system_admin")
    .eq("status", "active")
    .neq("id", excludeId);
  return count ?? 0;
}

function readValues(formData: FormData): UserFormState["values"] {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

export async function createUser(
  _previous: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const values = readValues(formData);
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed, values };

  const parsed = createUserSchema.safeParse({
    ...values,
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed, values };
  }
  const { email, password, fullName, phone, role } = parsed.data;

  // The sign in account is created with the service role. The profile is then
  // written as the signed in System Admin, so the audit log names who did it.
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const taken = createError?.code === "email_exists";
    return { error: taken ? text.emailTaken : text.failed, values };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    phone: phone || null,
    role,
    status: "active",
    must_change_password: true,
    created_by: me.id,
  });

  if (profileError) {
    // Do not leave a sign in account without a profile.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: text.failed, values };
  }

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUser(
  _previous: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const values = readValues(formData);
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed, values };

  const id = String(formData.get("id") ?? "");
  const idCheck = statusSchema.shape.id.safeParse(id);
  if (!idCheck.success) return { error: text.notFound, values };

  const parsed = editUserSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed, values };
  }
  const { fullName, phone, role } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: text.notFound, values };

  if (existing.role !== role) {
    if (id === me.id) return { error: text.ownRole, values };
    if (existing.role === "system_admin" && (await otherActiveAdmins(id)) === 0) {
      return { error: text.lastAdmin, values };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null, role })
    .eq("id", id);
  if (error) return { error: text.failed, values };

  revalidatePath("/users");
  redirect("/users");
}

export type StatusResult = { error: string | null };

// Deactivate or activate. Users are never deleted: their history stays in the
// records. A deactivated user is also blocked in Supabase Auth, so an open
// session cannot be refreshed.
export async function setUserStatus(
  _previous: StatusResult,
  formData: FormData,
): Promise<StatusResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: text.notFound };
  const { id, status } = parsed.data;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { error: text.notFound };

  if (status === "inactive") {
    if (id === me.id) return { error: text.ownStatus };
    if (
      target.role === "system_admin" &&
      target.status === "active" &&
      (await otherActiveAdmins(id)) === 0
    ) {
      return { error: text.lastAdmin };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", id);
  if (error) return { error: text.failed };

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(id, {
    ban_duration: status === "inactive" ? "876000h" : "none",
  });

  revalidatePath("/users");
  return { error: null };
}

// Permanent delete. Only an inactive user can be deleted, the System Admin must
// type the user's name, and nobody can delete their own account. The audit log
// keeps the deleted profile's values. The database enforces the same rules.
export async function deleteUser(
  _previous: StatusResult,
  formData: FormData,
): Promise<StatusResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const id = String(formData.get("id") ?? "");
  const typedName = String(formData.get("confirmName") ?? "");
  if (!statusSchema.shape.id.safeParse(id).success) {
    return { error: text.notFound };
  }
  if (id === me.id) return { error: text.ownDelete };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return { error: text.notFound };
  if (profile.status !== "inactive") return { error: text.deactivateFirst };
  if (typedName.trim() !== String(profile.full_name).trim()) {
    return { error: text.nameMismatch };
  }

  // The profile goes first, because it points at the sign in account.
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  if (profileError) return { error: text.failed };

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    // Put the profile back so the user is not left half deleted.
    await admin.from("profiles").insert(profile);
    return { error: text.failed };
  }

  revalidatePath("/users");
  return { error: null };
}
