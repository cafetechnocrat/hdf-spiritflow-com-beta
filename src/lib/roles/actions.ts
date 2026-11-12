"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  accessSchema,
  createRoleSchema,
  idSchema,
  locksSchema,
  switchSchema,
  updateRoleSchema,
  type RoleResult,
} from "./schemas";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  notFound: "That role was not found.",
  nameTaken: "A role with that name already exists. Choose another.",
  inUse: (count: number) =>
    `${count} ${count === 1 ? "user has" : "users have"} this role. Move them to another role on the Users screen first.`,
} as const;

const PATH = "/roles";

// Only the System Admin manages roles and access. The database enforces the
// same rule through Row Level Security, so this is the first gate, not the only one.
async function requireSystemAdmin() {
  const me = await getCurrentUser();
  return me && me.isSystemAdmin && !me.mustChangePassword ? me : null;
}

type DbError = { code?: string; message?: string } | null;

function explain(error: NonNullable<DbError>): string {
  if (error.code === "23505") return text.nameTaken;
  // Rules written in the database raise their own readable message.
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return text.notAllowed;
  return text.failed;
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function createRole(
  _previous: RoleResult,
  formData: FormData,
): Promise<RoleResult> {
  const me = await requireSystemAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = createRoleSchema.safeParse({
    name: field(formData, "name"),
    signInMethod: field(formData, "signInMethod"),
    copyFromId: field(formData, "copyFromId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("roles")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("roles")
    .insert({
      name: parsed.data.name,
      sign_in_method: parsed.data.signInMethod,
      sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error ? explain(error) : text.failed };

  // A new role can start from the access of an existing one.
  if (parsed.data.copyFromId) {
    const { data: rows } = await supabase
      .from("role_access")
      .select("feature_key, can_view, can_edit, can_delete")
      .eq("role_id", parsed.data.copyFromId);
    const copies = (rows ?? []).map((row) => ({
      role_id: created.id as string,
      feature_key: row.feature_key as string,
      can_view: row.can_view as boolean,
      can_edit: row.can_edit as boolean,
      can_delete: row.can_delete as boolean,
      created_by: me.id,
    }));
    if (copies.length > 0) {
      const { error: copyError } = await supabase.from("role_access").insert(copies);
      if (copyError) return { error: explain(copyError) };
    }
  }

  revalidatePath(PATH);
  return { error: null };
}

export async function updateRole(
  _previous: RoleResult,
  formData: FormData,
): Promise<RoleResult> {
  const me = await requireSystemAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = updateRoleSchema.safeParse({
    id: field(formData, "id"),
    name: field(formData, "name"),
    signInMethod: field(formData, "signInMethod"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({ name: parsed.data.name, sign_in_method: parsed.data.signInMethod })
    .eq("id", parsed.data.id);
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}

// A role can be deleted only when no user has it.
export async function deleteRole(
  _previous: RoleResult,
  formData: FormData,
): Promise<RoleResult> {
  const me = await requireSystemAdmin();
  if (!me) return { error: text.notAllowed };

  const id = field(formData, "id");
  if (!idSchema.safeParse(id).success) return { error: text.notFound };

  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role_id", id);
  if ((count ?? 0) > 0) return { error: text.inUse(count ?? 0) };

  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) {
    return { error: error.code === "23503" ? text.inUse(1) : explain(error) };
  }

  revalidatePath(PATH);
  return { error: null };
}

// The Active and Require Two-Factor switches on a role.
export async function setRoleSwitch(input: {
  id: string;
  kind: "active" | "two_factor";
  value: boolean;
}): Promise<RoleResult> {
  const me = await requireSystemAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = switchSchema.safeParse(input);
  if (!parsed.success) return { error: text.notFound };

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update(
      parsed.data.kind === "active"
        ? { is_active: parsed.data.value }
        : { requires_two_factor: parsed.data.value },
    )
    .eq("id", parsed.data.id);
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}

// Saves the View, Edit and Delete boxes of one role on one feature. The
// database refuses an action the feature does not offer, and Edit or Delete
// without View.
export async function setRoleAccess(input: {
  roleId: string;
  featureKey: string;
  view: boolean;
  edit: boolean;
  delete: boolean;
}): Promise<RoleResult> {
  const me = await requireSystemAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = accessSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const supabase = await createClient();
  const { error } = await supabase.from("role_access").upsert(
    {
      role_id: parsed.data.roleId,
      feature_key: parsed.data.featureKey,
      can_view: parsed.data.view,
      can_edit: parsed.data.edit,
      can_delete: parsed.data.delete,
      created_by: me.id,
    },
    { onConflict: "role_id,feature_key" },
  );
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}

// Locks or opens reports and dashboard cards for roles, one or many at once.
// Only features in the Reports and Dashboard Cards groups can be set here, and
// the System Admin role is always open, so it is never touched.
export async function setLocks(input: {
  roleIds: string[];
  featureKeys: string[];
  open: boolean;
}): Promise<RoleResult> {
  const me = await requireSystemAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = locksSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const supabase = await createClient();
  const [features, roles] = await Promise.all([
    supabase
      .from("features")
      .select("key")
      .in("key", parsed.data.featureKeys)
      .in("group_label", ["Reports", "Dashboard Cards"]),
    supabase
      .from("roles")
      .select("id")
      .in("id", parsed.data.roleIds)
      .eq("is_system", false),
  ]);
  if (features.error || roles.error) return { error: text.failed };
  const featureKeys = ((features.data ?? []) as { key: string }[]).map((f) => f.key);
  const roleIds = ((roles.data ?? []) as { id: string }[]).map((r) => r.id);
  if (featureKeys.length === 0 || roleIds.length === 0) return { error: text.notFound };

  const rows = roleIds.flatMap((roleId) =>
    featureKeys.map((featureKey) => ({
      role_id: roleId,
      feature_key: featureKey,
      can_view: parsed.data.open,
      can_edit: false,
      can_delete: false,
      created_by: me.id,
    })),
  );
  const { error } = await supabase
    .from("role_access")
    .upsert(rows, { onConflict: "role_id,feature_key" });
  if (error) return { error: explain(error) };

  revalidatePath(PATH);
  return { error: null };
}
