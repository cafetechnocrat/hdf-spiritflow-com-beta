import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  welcome: "Welcome",
  signedInAs: "Signed in as",
  placeholder: "Your workspace is being set up. Screens will appear here soon.",
  noAccess: "Your role has no access yet. Ask the System Admin to switch on what you need.",
} as const;

async function DashboardContent() {
  const user = await getCurrentUser();
  if (!user) return null;
  // The Dashboard is a feature the System Admin switches on for each role.
  const hasAny = Object.values(user.access).some((a) => a.view || a.edit || a.delete);

  return (
    <div>
      <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
        {text.welcome}, {user.fullName}
      </h1>
      <p className="mt-0.5 text-[0.88rem] text-muted">
        {text.signedInAs} {user.roleName}
      </p>
      <p className="mt-4 text-[0.9rem]">{hasAny ? text.placeholder : text.noAccess}</p>
    </div>
  );
}

// Placeholder dashboard. The real dashboard comes in a later step.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
