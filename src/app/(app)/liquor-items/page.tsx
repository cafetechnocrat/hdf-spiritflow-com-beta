import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiquorScreen } from "@/components/liquor/liquor-screen";
import { PageLoading } from "@/components/page-loading";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { parseItemQuery, type RawParams } from "@/lib/liquor/params";
import { loadItems, loadLookups } from "@/lib/liquor/queries";
import { loadTransactionDate } from "@/lib/vouchers/transaction-date";

// The Excel import saves thousands of rows in batches and needs more than the default time.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Liquor Items",
  subtitle:
    "The liquor inventory master. Every BevCo item is kept here. Active items are the ones you stock now; Inactive ones are on the BevCo list and can be bought later.",
  errorTitle: "The Items Could Not Be Loaded",
  errorHint: "Nothing was changed. Reload the page to try again.",
} as const;

async function LiquorContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  const me = await getCurrentUser();
  if (!me || !canView(me, "liquor_items")) notFound();

  const raw = await searchParams;
  // Rates are shown as on the transaction date unless another date is chosen.
  const today = await loadTransactionDate(me.id);
  const query = parseItemQuery(raw, today);
  const [page, lookups] = await Promise.all([
    loadItems(query).catch(() => null),
    loadLookups(),
  ]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 max-w-[70ch] text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      {page ? (
        <LiquorScreen
          page={page}
          query={query}
          lookups={lookups}
          canEdit={canEdit(me, "liquor_items")}
          canEditRates={canEdit(me, "liquor_rates")}
        />
      ) : (
        <div
          role="alert"
          className="rounded-2xl bg-surface px-4 py-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <strong className="block text-[1rem]">{text.errorTitle}</strong>
          <span className="text-[0.9rem] text-muted">{text.errorHint}</span>
        </div>
      )}
    </div>
  );
}

export default function LiquorItemsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <LiquorContent searchParams={searchParams} />
    </Suspense>
  );
}
