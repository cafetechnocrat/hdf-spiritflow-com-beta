import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClosingStockScreen } from "@/components/closing-stock/closing-stock-screen";
import { PageLoading } from "@/components/page-loading";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import {
  loadBookStock,
  loadClosingStockHistory,
  loadStockAccounts,
} from "@/lib/closing-stock/queries";
import { loadTransactionDate, todayInIndia } from "@/lib/vouchers/transaction-date";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

// All visible text sits here so it can be translated later.
const text = {
  title: "Closing Stock",
  subtitle:
    "Enter the closing stock value at cost for the day. Spirit Flow posts the difference to the books, so Gross Profit uses the stock that was really consumed.",
  errorTitle: "Closing Stock Could Not Be Loaded",
  errorHint: "Nothing was changed. Reload the page to try again.",
} as const;

async function ClosingStockContent({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[] }>;
}) {
  const me = await getCurrentUser();
  if (!me || !canView(me, "closing_stock")) notFound();

  const { account } = await searchParams;
  const wanted = Array.isArray(account) ? account[0] : account;
  const today = todayInIndia();

  const loaded = await (async () => {
    const accounts = await loadStockAccounts();
    const selected = accounts.find((a) => a.id === wanted) ?? accounts[0];
    if (!selected) return { accounts, selectedId: "", history: [], bookNow: "0.00" };
    const [history, bookNow] = await Promise.all([
      loadClosingStockHistory(selected.id),
      loadBookStock(selected.id, today),
    ]);
    return { accounts, selectedId: selected.id, history, bookNow };
  })().catch(() => null);

  const heading = (
    <div className="mb-4">
      <h1 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">{text.title}</h1>
      <p className="mt-0.5 text-[0.88rem] text-muted">{text.subtitle}</p>
    </div>
  );

  if (!loaded) {
    return (
      <div>
        {heading}
        <div
          role="alert"
          className="rounded-2xl bg-surface px-4 py-9 text-center text-[0.9rem] text-muted shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <strong className="mb-0.5 block text-[1rem] text-error">{text.errorTitle}</strong>
          {text.errorHint}
        </div>
      </div>
    );
  }

  const startDate = await loadTransactionDate(me.id);

  return (
    <div>
      {heading}
      <ClosingStockScreen
        key={loaded.selectedId}
        data={{
          accounts: loaded.accounts,
          selectedId: loaded.selectedId,
          bookNow: loaded.bookNow,
          asOn: today,
          history: loaded.history,
          startDate,
          canEdit: canEdit(me, "closing_stock"),
          canChange: canEdit(me, "voucher_changes"),
          canOpenDayBook: canView(me, "report_day_book"),
        }}
      />
    </div>
  );
}

export default function ClosingStockPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ClosingStockContent searchParams={searchParams} />
    </Suspense>
  );
}
