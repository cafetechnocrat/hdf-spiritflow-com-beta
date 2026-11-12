import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { RolesManager } from "@/components/roles/roles-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadRolesData } from "@/lib/roles/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Roles And Access",
  subtitle:
    "Create roles, tick what each can do, which are active, and which need two-factor sign in. Changes save as soon as you make them.",
} as const;

async function RolesContent() {
  const me = await getCurrentUser();
  // Only the System Admin manages roles and access.
  if (!me || !me.isSystemAdmin || me.mustChangePassword) notFound();

  const data = await loadRolesData();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <RolesManager data={data} />
    </div>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RolesContent />
    </Suspense>
  );
}
