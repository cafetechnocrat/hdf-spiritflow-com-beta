import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { StockCountScreen } from "@/components/stock-count/stock-count-screen";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { loadCount, loadItems, loadPoints } from "@/lib/stock-count/queries";
import type { CountRights } from "@/lib/stock-count/types";
import { loadTransactionDate } from "@/lib/vouchers/transaction-date";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  title: "Stock Count",
  subtitle:
    "Physical stock taking, by stock point and date. Every entry is saved as you type, so a count can continue on another phone.",
  errorTitle: "The Stock Count Could Not Be Loaded",
  errorHint: "Nothing was changed. Reload the page to try again.",
} as const;

type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function StockCountContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  const me = await getCurrentUser();
  if (!me || !canView(me, "stock_count")) notFound();

  const raw = await searchParams;
  const today = await loadTransactionDate(me.id);
  const dateParam = one(raw.date);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  // The stock points and the items come from the database. Nothing is listed in code.
  const [points, items] = await Promise.all([
    loadPoints().catch(() => null),
    loadItems().catch(() => null),
  ]);

  const rights: CountRights = {
    take: canEdit(me, "stock_count"),
    save: canEdit(me, "stock_count_save"),
    exportFiles: canEdit(me, "stock_count_export"),
    viewValue: canView(me, "stock_count_value"),
    // Posting shows the total, so it needs the value right too.
    post: canEdit(me, "stock_count_post") && canView(me, "stock_count_value"),
  };

  let body;
  if (!points || !items) {
    body = (
      <div
        role="alert"
        className="rounded-2xl bg-surface px-4 py-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      >
        <strong className="block text-[1rem]">{text.errorTitle}</strong>
        <span className="text-[0.9rem] text-muted">{text.errorHint}</span>
      </div>
    );
  } else {
    const wanted = one(raw.point);
    const point = points.find((p) => p.id === wanted) ?? points[0];
    const count = point ? await loadCount(point.id, date) : { header: null, entries: {} };
    body = (
      <StockCountScreen
        points={points}
        items={items}
        pointId={point?.id ?? ""}
        date={date}
        header={count.header}
        entries={count.entries}
        rights={rights}
        userName={me.fullName}
        today={today}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
          {text.title}
        </h1>
        <p className="mt-0.5 max-w-[70ch] text-[0.88rem] text-muted">{text.subtitle}</p>
      </div>
      {body}
    </div>
  );
}

export default function StockCountPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <StockCountContent searchParams={searchParams} />
    </Suspense>
  );
}
