import "server-only";
import { formatDate } from "@/lib/format/money";
import { loadReportContext } from "@/lib/reports/build";
import type { DocRow, DocTable, ReportDocument } from "@/lib/reports/types";
import { itemSubline, itemTitle } from "@/lib/liquor/calc";
import { loadCount, loadItems, loadPoints } from "./queries";
import { needsPegs } from "./types";

// The count sheet for the PDF and Excel files. It reuses the report document, so
// the files look like the other reports. Quantities only, never a value.
export async function buildCountDocument(
  pointId: string,
  date: string,
  generatedBy: string,
): Promise<ReportDocument | null> {
  const [points, items, count, ctx] = await Promise.all([
    loadPoints(),
    loadItems(),
    loadCount(pointId, date),
    loadReportContext(generatedBy),
  ]);
  const point = points.find((p) => p.id === pointId);
  if (!point || !count.header || count.header.status !== "complete") return null;

  const categories: string[] = [];
  for (const item of items) {
    if (!categories.includes(item.categoryName)) categories.push(item.categoryName);
  }

  let bottles = 0;
  let pegs = 0;
  const tables: DocTable[] = categories.map((category) => {
    const rows: DocRow[] = items
      .filter((item) => item.categoryName === category)
      .map((item) => {
        const entry = count.entries[item.id];
        const b = Number(entry?.b || 0);
        const hasPegs = needsPegs(point, item);
        const p = hasPegs ? Number(entry?.p || 0) : 0;
        bottles += b;
        pegs += p;
        return {
          style: "normal" as const,
          cells: [
            { text: `${itemTitle(item.stockName, item.volumeMl)}  ${itemSubline(item.itemCode, item.itemName, item.stockName)}` },
            { text: String(b), value: b },
            hasPegs ? { text: String(p), value: p } : { text: "-" },
          ],
        };
      });
    return {
      heading: category,
      columns: [
        { label: "Item", align: "left" as const },
        { label: "Bottles", align: "right" as const },
        { label: "Pegs", align: "right" as const },
      ],
      rows,
    };
  });

  return {
    key: "stock-count",
    title: `Physical Stock Count Sheet - ${point.name}`,
    hotelName: ctx.hotelName,
    period: `Stock as on ${formatDate(date)}`,
    filters: [
      `Stock point: ${point.name}`,
      count.header.countedBy ? `Counted by: ${count.header.countedBy}` : "",
      "Status: Complete",
    ]
      .filter(Boolean)
      .join(". "),
    generatedBy: ctx.generatedBy,
    generatedAt: ctx.generatedAt,
    kpis: [
      { label: "Items", value: String(items.length) },
      { label: "Bottles", value: String(bottles) },
      ...(point.pegAllowed ? [{ label: "Pegs", value: String(pegs) }] : []),
    ],
    tables,
    notes: ["Quantities only. No values."],
    empty: false,
    emptyTitle: "",
    emptyHint: "",
  };
}
