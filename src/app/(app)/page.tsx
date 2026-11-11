import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  welcome: "Welcome",
  signedInAs: "Signed in as",
  placeholder: "Your workspace is being set up. Screens will appear here soon.",
} as const;

// Placeholder dashboard. The real dashboard comes in a later step.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div>
      <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
        {text.welcome}, {user.fullName}
      </h1>
      <p className="mt-0.5 text-[0.88rem] text-muted">
        {text.signedInAs} {ROLE_LABELS[user.role]}
      </p>
      <p className="mt-4 text-[0.9rem]">{text.placeholder}</p>
    </div>
  );
}
