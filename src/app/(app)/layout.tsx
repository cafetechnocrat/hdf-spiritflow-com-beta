import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { NoAccess } from "@/components/no-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { buildMenu } from "@/lib/nav/menu";
import { MENU_COOKIE } from "@/lib/nav/menu-cookie";
import { loadPeriod } from "@/lib/period/queries";
import { loadTransactionDate, todayInIndia } from "@/lib/vouchers/transaction-date";

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

  // Roles that enter transactions see the transaction date in the top bar.
  const transactionDate = canEdit(user, "transactions")
    ? { date: await loadTransactionDate(user.id), today: todayInIndia() }
    : null;

  // Roles that see the accounts pick the financial year in the top bar.
  const period =
    canView(user, "reports") || canEdit(user, "transactions")
      ? await loadPeriod(user.id)
      : null;

  return (
    <AppShell
      transactionDate={transactionDate}
      financialYear={
        period ? { selected: period.selected, current: period.current, years: period.years } : null
      }
      user={{ fullName: user.fullName, roleLabel: user.roleName }}
      menu={buildMenu(user)}
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
