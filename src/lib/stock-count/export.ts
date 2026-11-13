import "server-only";
import { formatDate } from "@/lib/format/money";
import { itemSubline, itemTitle } from "@/lib/liquor/calc";
import { loadReportContext } from "@/lib/reports/build";
import type { CountSheet, SheetCategory } from "./files";
import { loadCount, loadItems, loadPoints } from "./queries";
import { isCounted, needsPegs } from "./types";

// The data of a saved count, arranged for the PDF and Excel sheet. Only a Complete
// count can be exported.
export async function loadCountSheet(
  pointId: string,
  date: string,
  generatedBy: string,
): Promise<CountSheet | null> {
  const [points, items, count, ctx] = await Promise.all([
    loadPoints(),
    loadItems(),
    loadCount(pointId, date),
    loadReportContext(generatedBy),
  ]);
  const point = points.find((p) => p.id === pointId);
  if (!point || !count.header || count.header.status !== "complete") return null;

  const categories: SheetCategory[] = [];
  let no = 0;
  for (const item of items) {
    let category = categories.find((c) => c.name === item.categoryName);
    if (!category) {
      category = { name: item.categoryName, rows: [] };
      categories.push(category);
    }
    no += 1;
    const entry = count.entries[item.id];
    category.rows.push({
      no,
      title: itemTitle(item.stockName, item.volumeMl),
      subtitle: itemSubline(item.itemCode, item.itemName, item.stockName),
      bottles: Number(entry?.b || 0),
      pegs: needsPegs(point, item) ? Number(entry?.p || 0) : null,
    });
  }

  return {
    hotelName: ctx.hotelName,
    pointName: point.name,
    date: formatDate(date),
    countedBy: count.header.countedBy,
    itemsCounted: items.filter((item) => isCounted(point, item, count.entries[item.id])).length,
    itemsTotal: items.length,
    pegsColumn: point.pegAllowed,
    generatedBy: ctx.generatedBy,
    generatedAt: ctx.generatedAt,
    categories,
  };
}
