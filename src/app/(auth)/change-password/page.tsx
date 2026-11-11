import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChangePasswordCard } from "@/components/auth/change-password-card";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

async function ChangePasswordContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ChangePasswordCard forced={user.mustChangePassword} />;
}

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-7">
      <Suspense fallback={null}>
        <ChangePasswordContent />
      </Suspense>
    </main>
  );
}
