"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  notFound: "That user was not found.",
  ownAccess: "You cannot change your own access.",
} as const;

export type UserAccessResult = { error: string | null };

const accessInput = z.object({
  userId: z.uuid(),
  featureKey: z.string().regex(/^[a-z_]{1,40}$/),
  view: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

// Anyone who can edit users may narrow a user's access, always inside that
// user's role, and never their own. The database enforces the same rules.
async function requireEditor() {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit(me, "users") ? me : null;
}

function explain(error: { code?: string; message?: string }): string {
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return text.notAllowed;
  return text.failed;
}

// Saves the boxes of one feature for one user. If they match the role exactly
// there is nothing custom, so the row is removed.
export async function setUserAccess(input: {
  userId: string;
  featureKey: string;
  view: boolean;
  edit: boolean;
  delete: boolean;
}): Promise<UserAccessResult> {
  const me = await requireEditor();
  if (!me) return { error: text.notAllowed };

  const parsed = accessInput.safeParse(input);
  if (!parsed.success) return { error: text.failed };
  const data = parsed.data;
  if (data.userId === me.id) return { error: text.ownAccess };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id")
    .eq("id", data.userId)
    .maybeSingle();
  if (!profile) return { error: text.notFound };

  const { data: roleRow } = await supabase
    .from("role_access")
    .select("can_view, can_edit, can_delete")
    .eq("role_id", profile.role_id as string)
    .eq("feature_key", data.featureKey)
    .maybeSingle();

  const same =
    data.view === (roleRow?.can_view ?? false) &&
    data.edit === (roleRow?.can_edit ?? false) &&
    data.delete === (roleRow?.can_delete ?? false);

  const { error } = same
    ? await supabase
        .from("user_access")
        .delete()
        .eq("user_id", data.userId)
        .eq("feature_key", data.featureKey)
    : await supabase.from("user_access").upsert(
        {
          user_id: data.userId,
          feature_key: data.featureKey,
          can_view: data.view,
          can_edit: data.edit,
          can_delete: data.delete,
          created_by: me.id,
        },
        { onConflict: "user_id,feature_key" },
      );
  if (error) return { error: explain(error) };

  revalidatePath("/users");
  revalidatePath(`/users/${data.userId}`);
  return { error: null };
}

// Gives back everything the role allows.
export async function resetUserAccess(userId: string): Promise<UserAccessResult> {
  const me = await requireEditor();
  if (!me) return { error: text.notAllowed };
  if (!z.uuid().safeParse(userId).success) return { error: text.notFound };
  if (userId === me.id) return { error: text.ownAccess };

  const supabase = await createClient();
  const { error } = await supabase.from("user_access").delete().eq("user_id", userId);
  if (error) return { error: explain(error) };

  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  return { error: null };
}
