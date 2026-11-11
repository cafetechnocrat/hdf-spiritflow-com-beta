import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { NoAccess } from "@/components/no-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { buildMenu } from "@/lib/nav/menu";
import { MENU_COOKIE } from "@/lib/nav/menu-cookie";

const text = {
  loading: "Loading...",
} as const;

// Everything for signed in users. The session is read at request time, so the
// whole shell streams in behind this boundary.
async function Shell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <NoAccess />;
  // A temporary password must be replaced before anything else.
  if (user.mustChangePassword) redirect("/change-password");
  // Roles that use an authenticator app must set it up and pass it each sign in.
  if (user.twoFactor === "setup") redirect("/two-factor/setup");
  if (user.twoFactor === "verify") redirect("/two-factor/verify");

  const collapsed = (await cookies()).get(MENU_COOKIE)?.value === "collapsed";

  return (
    <AppShell
      user={{ fullName: user.fullName, roleLabel: ROLE_LABELS[user.role] }}
      menu={buildMenu(user.role)}
      initialCollapsed={collapsed}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="grid min-h-dvh place-items-center text-[0.9rem] text-muted">
          {text.loading}
        </p>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}
