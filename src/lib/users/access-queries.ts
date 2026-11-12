import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccessFlags, UserAccessData } from "./access-types";

type Flags = { feature_key: string; can_view: boolean; can_edit: boolean; can_delete: boolean };

// The Access section of one user: every feature, what the user's role allows,
// and what the user has now. Row Level Security limits who can read it.
export async function loadUserAccess(userId: string): Promise<UserAccessData | null> {
  // Reject anything that is not a UUID before it reaches the database.
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role_id, roles(name, is_system)")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const embedded = profile.roles as unknown as
    | { name: string; is_system: boolean }
    | { name: string; is_system: boolean }[]
    | null;
  const role = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!role) return null;

  const [featuresResult, roleResult, userResult] = await Promise.all([
    supabase
      .from("features")
      .select("key, label, group_label, offers_view, offers_edit, offers_delete")
      .order("sort_order"),
    supabase
      .from("role_access")
      .select("feature_key, can_view, can_edit, can_delete")
      .eq("role_id", profile.role_id as string),
    supabase
      .from("user_access")
      .select("feature_key, can_view, can_edit, can_delete")
      .eq("user_id", userId),
  ]);

  const toFlags = (row: Flags): AccessFlags => ({
    view: row.can_view,
    edit: row.can_edit,
    delete: row.can_delete,
  });
  const roleFlags = new Map(((roleResult.data ?? []) as Flags[]).map((r) => [r.feature_key, toFlags(r)]));
  const userFlags = new Map(((userResult.data ?? []) as Flags[]).map((r) => [r.feature_key, toFlags(r)]));
  const none: AccessFlags = { view: false, edit: false, delete: false };

  return {
    userId,
    roleName: role.name,
    isSystem: role.is_system,
    features: (
      (featuresResult.data ?? []) as {
        key: string;
        label: string;
        group_label: string;
        offers_view: boolean;
        offers_edit: boolean;
        offers_delete: boolean;
      }[]
    ).map((feature) => {
      const allowed = roleFlags.get(feature.key) ?? none;
      const own = userFlags.get(feature.key);
      return {
        key: feature.key,
        label: feature.label,
        group: feature.group_label,
        offersView: feature.offers_view,
        offersEdit: feature.offers_edit,
        offersDelete: feature.offers_delete,
        role: allowed,
        // The user's own row only narrows the role. No row means the role's access.
        user: own
          ? {
              view: allowed.view && own.view,
              edit: allowed.edit && own.edit,
              delete: allowed.delete && own.delete,
            }
          : allowed,
      };
    }),
  };
}
