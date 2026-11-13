import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingPopup } from "@/components/loading-popup";
import { VoucherManager } from "@/components/vouchers/voucher-manager";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView, canDelete } from "@/lib/auth/permissions";
import { parseVoucherQuery, type RawParams } from "@/lib/vouchers/params";
import { loadVoucherData } from "@/lib/vouchers/queries";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Transactions",
  subtitle:
    "Vouchers entered against ledgers. Editing or voiding a posted voucher needs a reason.",
} as const;

async function TransactionsContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  const me = await getCurrentUser();
  if (!me || !canView(me, "transactions")) notFound();

  const query = parseVoucherQuery(await searchParams);
  const data = await loadVoucherData(me.id, query);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      <VoucherManager
        data={data}
        canEnter={canEdit(me, "transactions")}
        canChange={canEdit(me, "voucher_changes")}
        canDelete={canDelete(me, "transactions")}
      />
    </div>
  );
}

export default function TransactionsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <Suspense fallback={<LoadingPopup />}>
      <TransactionsContent searchParams={searchParams} />
    </Suspense>
  );
}
