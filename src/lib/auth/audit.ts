import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AuthEvent =
  | "login"
  | "logout"
  | "failed_login"
  | "password_change"
  | "password_reset"
  | "mfa_enrol"
  | "mfa_reset";

// Writes a security event to the audit log. Uses the service role because no
// signed-in user is allowed to write to the log directly. A logging problem
// must never block a sign in, so errors are swallowed here.
// `actorId` is who did it. `recordId` is who it was done to (defaults to actor).
export async function logAuthEvent(
  action: AuthEvent,
  details: {
    actorId?: string;
    recordId?: string;
    data?: Record<string, string>;
  },
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_id: details.actorId ?? null,
      action,
      table_name: "auth",
      record_id: details.recordId ?? details.actorId ?? null,
      new_data: details.data ?? null,
    });
  } catch {
    // Intentionally ignored.
  }
}
