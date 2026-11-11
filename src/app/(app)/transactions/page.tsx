import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { VoucherManager } from "@/components/vouchers/voucher-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { loadVoucherData } from "@/lib/vouchers/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Transactions",
  subtitle:
    "Vouchers entered against ledgers. Posted vouchers are never deleted. Only the Chief Accountant can edit or void one, with a reason.",
} as const;

async function TransactionsContent() {
  const me = await getCurrentUser();
  if (!me || !canView("transactions", me.role)) notFound();

  const data = await loadVoucherData(me.id);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <VoucherManager
        data={data}
        canEnter={canEdit("transactions", me.role)}
        canChange={canEdit("voucher_changes", me.role)}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TransactionsContent />
    </Suspense>
  );
}
