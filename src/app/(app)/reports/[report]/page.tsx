import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { ReportScreen } from "@/components/reports/report-screen";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canView } from "@/lib/auth/permissions";
import {
  buildReport,
  loadFilterOptions,
  loadReportContext,
} from "@/lib/reports/build";
import { reportFilterFields } from "@/lib/reports/filters";
import { parseReportParams, type RawParams } from "@/lib/reports/params";
import { isReportKey, REPORT_TITLES, type ReportDocument } from "@/lib/reports/types";
import { loadPeriod } from "@/lib/period/queries";
import { loadTransactionDate } from "@/lib/vouchers/transaction-date";

export const metadata: Metadata = {
  title: "Spirit Flow",
  robots: { index: false, follow: false },
};

const text = {
  errorTitle: "The Report Could Not Be Loaded",
  errorHint: "Nothing was changed. Reload the page to try again.",
} as const;

async function ReportContent({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { report } = await params;
  if (!isReportKey(report)) notFound();

  const me = await getCurrentUser();
  if (!me || !canView(me, "reports")) notFound();

  const raw = await searchParams;
  const [transactionDate, period] = await Promise.all([
    loadTransactionDate(me.id),
    loadPeriod(me.id),
  ]);
  const reportParams = parseReportParams(report, raw, {
    transactionDate,
    fyStart: period.start,
    fyEnd: period.end,
  });

  let doc: ReportDocument | null = null;
  let options: Awaited<ReturnType<typeof loadFilterOptions>> | null = null;
  try {
    const ctx = await loadReportContext(me.fullName);
    [doc, options] = await Promise.all([
      buildReport(report, reportParams, ctx),
      loadFilterOptions(),
    ]);
  } catch {
    doc = null;
  }

  if (!doc || !options) {
    return (
      <div>
        <h1 className="mb-3 text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
          {REPORT_TITLES[report]}
        </h1>
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

  const fields = reportFilterFields(report, reportParams, options);
  return <ReportScreen doc={doc} fields={fields} />;
}

export default function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<RawParams>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
