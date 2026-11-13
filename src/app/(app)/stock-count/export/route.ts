import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { buildExcel, buildPdf, fileName } from "@/lib/reports/export-files";
import { buildCountDocument } from "@/lib/stock-count/export";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PDF and Excel of a saved count. Needs the Stock Count view and the Export right.
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return new Response("Not allowed", { status: 403 });
  if (!canView(me, "stock_count") || !canEdit(me, "stock_count_export")) {
    return new Response("You do not have permission to export a stock count.", { status: 403 });
  }

  const url = new URL(request.url);
  const point = url.searchParams.get("point") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const format = url.searchParams.get("format");
  if (
    !UUID.test(point) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (format !== "xlsx" && format !== "pdf")
  ) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const doc = await buildCountDocument(point, date, me.fullName);
    if (!doc) return new Response("Save the count first. Only a Complete count can be exported.", { status: 409 });
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
