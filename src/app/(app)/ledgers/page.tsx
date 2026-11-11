import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LedgerManager } from "@/components/ledgers/ledger-manager";
import { PageLoading } from "@/components/page-loading";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { loadLedgerData } from "@/lib/ledgers/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Ledger Groups And Ledgers",
  subtitle:
    "Groups organise the ledgers. Ledgers are the accounts that transactions are posted to. Only the Chief Accountant and the System Admin can change either.",
} as const;

async function LedgersContent() {
  const me = await getCurrentUser();
  if (!me || !canView("ledgers", me.role)) notFound();

  const data = await loadLedgerData();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <LedgerManager data={data} canEdit={canEdit("ledgers", me.role)} />
    </div>
  );
}

export default function LedgersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LedgersContent />
    </Suspense>
  );
}
