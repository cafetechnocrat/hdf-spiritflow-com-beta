import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type AuthEvent = "login" | "logout" | "failed_login";

// Writes a sign-in event to the audit log. Uses the service role because no
// signed-in user is allowed to write to the log directly. A logging problem
// must never block a sign in, so errors are swallowed here.
export async function logAuthEvent(
  action: AuthEvent,
  details: { actorId?: string; data?: Record<string, string> },
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_id: details.actorId ?? null,
      action,
      table_name: "auth",
      record_id: details.actorId ?? null,
      new_data: details.data ?? null,
    });
  } catch {
    // Intentionally ignored.
  }
}
