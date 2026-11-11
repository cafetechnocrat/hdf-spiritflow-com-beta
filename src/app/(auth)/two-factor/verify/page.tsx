import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TwoFactorVerifyCard } from "@/components/auth/two-factor-verify-card";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

async function Content() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.twoFactor === "setup") redirect("/two-factor/setup");
  if (user.twoFactor !== "verify") redirect("/");
  return <TwoFactorVerifyCard />;
}

export default function TwoFactorVerifyPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-7">
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </main>
  );
}
