import { Suspense } from "react";
import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { NoAccess } from "@/components/no-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canView } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";

const text = {
  loading: "Loading...",
  dashboard: "Dashboard",
  users: "Users",
} as const;

// Everything for signed in users. The session is read at request time, so the
// whole shell streams in behind this boundary.
async function Shell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <NoAccess />;

  // Items a role cannot use are hidden.
  const nav: NavItem[] = [];
  if (canView("dashboard", user.role)) {
    nav.push({ href: "/", label: text.dashboard, icon: "home" });
  }
  if (canView("users", user.role)) {
    nav.push({ href: "/users", label: text.users, icon: "users" });
  }

  return (
    <AppShell
      user={{ fullName: user.fullName, roleLabel: ROLE_LABELS[user.role] }}
      nav={nav}
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
