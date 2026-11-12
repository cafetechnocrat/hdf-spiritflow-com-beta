import { getCurrentUser } from "@/lib/auth/current-user";
import { canView } from "@/lib/auth/permissions";
import { buildReport, loadReportContext } from "@/lib/reports/build";
import { buildExcel, buildPdf, fileName } from "@/lib/reports/export-files";
import { parseReportParams } from "@/lib/reports/params";
import { isReportKey } from "@/lib/reports/types";
import { loadPeriod } from "@/lib/period/queries";
import { loadTransactionDate } from "@/lib/vouchers/transaction-date";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Excel and PDF downloads. They build the same document as the screen, so the
// figures always agree. The person must be signed in and allowed to see reports.
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (!me || !canView("reports", me.role)) {
    return new Response("Not allowed", { status: 403 });
  }

  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "";
  const format = url.searchParams.get("format");
  if (!isReportKey(report) || (format !== "xlsx" && format !== "pdf")) {
    return new Response("Not found", { status: 404 });
  }

  const raw: Record<string, string> = {};
  for (const [name, value] of url.searchParams) raw[name] = value;

  try {
    const [transactionDate, period] = await Promise.all([
      loadTransactionDate(me.id),
      loadPeriod(me.id),
    ]);
    const params = parseReportParams(report, raw, {
      transactionDate,
      fyStart: period.start,
      fyEnd: period.end,
    });
    const ctx = await loadReportContext(me.fullName);
    const doc = await buildReport(report, params, ctx);

    const body = format === "xlsx" ? await buildExcel(doc) : buildPdf(doc);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": format === "xlsx" ? XLSX_TYPE : "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName(doc, format)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("The file could not be built. Try again.", { status: 500 });
  }
}
