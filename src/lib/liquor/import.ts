import "server-only";
import ExcelJS from "exceljs";
import { parseAmountToPaise } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { cessForPrice } from "./calc";

// Reads the BevCo item file and checks it before anything is saved. The same
// reader serves the first load and a later price list update.

export type ImportMode = "first" | "update";

export type ImportRow = {
  row: number;
  itemCode: string;
  itemName: string;
  stockName: string;
  type: string;
  category: string;
  volumeMl: number;
  bottlesPerCase: number;
  pegSaleAllowed: boolean;
  status: "active" | "inactive";
  caseRate: string;
  fl1Price: string;
};

export type ImportIssue = {
  row: number;
  code: string;
  level: "error" | "warning";
  message: string;
};

export type ImportSummary = {
  rowsRead: number;
  activeRows: number;
  inactiveRows: number;
  newItems: number;
  existingItems: number;
  newRates: number;
  unchangedRates: number;
  newCategories: string[];
  newTypes: string[];
  errors: number;
  warnings: number;
  issues: ImportIssue[];
  // Rows to send to the database. Empty when there are errors.
  rows: ImportRow[];
};

const MAX_ISSUES_SHOWN = 100;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
    return "";
  }
  return String(value).trim();
}

// A number from the sheet as a two-decimal amount text, or null.
function amountFromCell(value: ExcelJS.CellValue): string | null {
  const raw = cellText(value).replace(/,/g, "");
  if (raw === "") return null;
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0) return null;
  const fixed = number.toFixed(2);
  return parseAmountToPaise(fixed) === null ? null : fixed;
}

export async function readImportFile(
  buffer: ArrayBuffer,
  mode: ImportMode,
): Promise<{ rows: ImportRow[]; issues: ImportIssue[]; fatal: string | null }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      rows: [],
      issues: [],
      fatal: "The file could not be read. Use the Excel file (.xlsx).",
    };
  }
  const sheet = workbook.getWorksheet("Inventory Master") ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], issues: [], fatal: "The file has no sheet." };

  // Find the header row and the columns by their names.
  let headerRow = 0;
  const columns = new Map<string, number>();
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r += 1) {
    const found = new Map<string, number>();
    sheet.getRow(r).eachCell((cell, colNumber) => {
      found.set(cellText(cell.value).toLowerCase(), colNumber);
    });
    if (found.has("item code")) {
      headerRow = r;
      for (const [name, colNumber] of found) columns.set(name, colNumber);
      break;
    }
  }
  if (!headerRow) {
    return { rows: [], issues: [], fatal: "The header row with Item Code was not found." };
  }
  const find = (prefix: string) =>
    [...columns.entries()].find(([name]) => name.startsWith(prefix))?.[1];
  const col = {
    code: find("item code"),
    name: find("item name"),
    stock: find("stock report name"),
    type: find("type"),
    category: find("category"),
    volume: find("uom"),
    bpc: find("bottles"),
    caseRate: find("case rate"),
    fl1: find("fl1"),
    cess: find("cess"),
    peg: find("peg sale"),
    status: find("status"),
  };
  const needed: [string, number | undefined][] =
    mode === "first"
      ? [
          ["Item Code", col.code],
          ["Item Name", col.name],
          ["Stock Report Name", col.stock],
          ["Type", col.type],
          ["Category", col.category],
          ["UOM (ml)", col.volume],
          ["Bottles / Case", col.bpc],
          ["Case Rate", col.caseRate],
          ["FL1 Shop Price", col.fl1],
          ["Peg Sale Allowed", col.peg],
          ["Status", col.status],
        ]
      : [
          ["Item Code", col.code],
          ["Case Rate", col.caseRate],
          ["FL1 Shop Price", col.fl1],
        ];
  const missing = needed.filter(([, c]) => !c).map(([label]) => label);
  if (missing.length > 0) {
    return {
      rows: [],
      issues: [],
      fatal: `The file has no column for: ${missing.join(", ")}.`,
    };
  }

  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const at = (row: ExcelJS.Row, c: number | undefined) =>
    c ? cellText(row.getCell(c).value) : "";

  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const code = at(row, col.code);
    // Note lines under the table have no item code.
    if (code === "") continue;
    const problem = (message: string, level: "error" | "warning" = "error") =>
      issues.push({ row: r, code, level, message });

    if (seen.has(code.toUpperCase())) {
      problem("The item code appears twice in the file.");
      continue;
    }
    seen.add(code.toUpperCase());

    const caseRate = amountFromCell(row.getCell(col.caseRate!).value);
    const fl1Price = amountFromCell(row.getCell(col.fl1!).value);
    if (caseRate === null) problem("The case rate is missing or not a number.");
    if (fl1Price === null) problem("The FL1 shop price is missing or not a number.");

    if (mode === "update") {
      if (caseRate !== null && fl1Price !== null) {
        rows.push({
          row: r,
          itemCode: code,
          itemName: "",
          stockName: "",
          type: "",
          category: "",
          volumeMl: 0,
          bottlesPerCase: 0,
          pegSaleAllowed: false,
          status: "active",
          caseRate,
          fl1Price,
        });
      }
      continue;
    }

    const volume = Number(at(row, col.volume));
    const bpc = Number(at(row, col.bpc));
    const status = at(row, col.status).toLowerCase();
    const peg = at(row, col.peg).toLowerCase();
    const itemName = at(row, col.name);
    const stockName = at(row, col.stock);
    const type = at(row, col.type);
    const category = at(row, col.category);
    if (!itemName) problem("The item name is missing.");
    if (!stockName) problem("The stock report name is missing.");
    if (!type) problem("The type is missing.");
    if (!category) problem("The category is missing.");
    if (!Number.isInteger(volume) || volume <= 0) problem("The volume (ml) is not a whole number.");
    if (!Number.isInteger(bpc) || bpc <= 0) problem("Bottles per case is not a whole number.");
    if (status !== "active" && status !== "inactive") {
      problem("The status must be Active or Inactive.");
    }
    if (peg !== "yes" && peg !== "no") problem("Peg Sale Allowed must be Yes or No.");

    // The database sets the cess from the FL1 price. If the file shows another
    // figure, say so. The rule wins.
    if (col.cess && fl1Price !== null) {
      const fileCess = amountFromCell(row.getCell(col.cess).value);
      const ruleCess = cessForPrice(fl1Price);
      if (fileCess !== null && ruleCess !== null && fileCess !== ruleCess) {
        problem(
          `Cess is ${fileCess} in the file but the FL1 price of ${fl1Price} gives ${ruleCess} by the cess rule. The rule is used.`,
          "warning",
        );
      }
    }

    if (
      caseRate !== null &&
      fl1Price !== null &&
      itemName &&
      stockName &&
      type &&
      category &&
      Number.isInteger(volume) &&
      volume > 0 &&
      Number.isInteger(bpc) &&
      bpc > 0 &&
      (status === "active" || status === "inactive") &&
      (peg === "yes" || peg === "no")
    ) {
      rows.push({
        row: r,
        itemCode: code,
        itemName,
        stockName,
        type,
        category,
        volumeMl: volume,
        bottlesPerCase: bpc,
        pegSaleAllowed: peg === "yes",
        status,
        caseRate,
        fl1Price,
      });
    }
  }
  return { rows, issues, fatal: null };
}

// Reads every row of a table, a thousand at a time.
async function readAll<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await load(from, from + 999);
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return all;
}

// Compares the file with what the database holds and builds the summary shown
// before anything is saved.
export async function summariseImport(
  rows: ImportRow[],
  issues: ImportIssue[],
  mode: ImportMode,
  effective: string,
): Promise<ImportSummary> {
  const supabase = await createClient();
  const [items, rates, categories, types] = await Promise.all([
    readAll<{ id: string; item_code: string }>((from, to) =>
      supabase.from("liquor_items").select("id, item_code").order("id").range(from, to),
    ),
    readAll<{
      item_id: string;
      effective_date: string;
      case_rate: number | string;
      fl1_price: number | string;
    }>((from, to) =>
      supabase
        .from("liquor_item_rates")
        .select("item_id, effective_date, case_rate, fl1_price")
        .lte("effective_date", effective)
        .order("item_id")
        .order("effective_date", { ascending: false })
        .range(from, to),
    ),
    supabase.from("liquor_categories").select("name"),
    supabase.from("liquor_types").select("name"),
  ]);

  const byCode = new Map(items.map((i) => [i.item_code.trim().toUpperCase(), i.id]));
  const inForce = new Map<string, { caseRate: string; fl1: string }>();
  for (const r of rates) {
    // Rows come newest first, so the first one seen for an item is in force.
    if (!inForce.has(r.item_id)) {
      inForce.set(r.item_id, {
        caseRate: Number(r.case_rate).toFixed(2),
        fl1: Number(r.fl1_price).toFixed(2),
      });
    }
  }
  const knownCategories = new Set(
    (categories.data ?? []).map((c) => c.name.trim().toLowerCase()),
  );
  const knownTypes = new Set((types.data ?? []).map((t) => t.name.trim().toLowerCase()));

  let newItems = 0;
  let existingItems = 0;
  let newRates = 0;
  let unchangedRates = 0;
  const newCategories = new Set<string>();
  const newTypes = new Set<string>();
  const extra: ImportIssue[] = [];

  for (const row of rows) {
    const id = byCode.get(row.itemCode.toUpperCase());
    if (id) {
      existingItems += 1;
      const current = inForce.get(id);
      if (current && current.caseRate === row.caseRate && current.fl1 === row.fl1Price) {
        unchangedRates += 1;
      } else {
        newRates += 1;
      }
    } else if (mode === "first") {
      newItems += 1;
      newRates += 1;
    } else {
      extra.push({
        row: row.row,
        code: row.itemCode,
        level: "warning",
        message:
          "This item is not in the database. A price list update does not create items, so it is skipped.",
      });
    }
    if (mode === "first") {
      if (!knownCategories.has(row.category.toLowerCase())) newCategories.add(row.category);
      if (!knownTypes.has(row.type.toLowerCase())) newTypes.add(row.type.toUpperCase());
    }
  }

  const all = [...issues, ...extra];
  const errors = all.filter((i) => i.level === "error").length;
  return {
    rowsRead: rows.length + errors,
    activeRows: rows.filter((r) => r.status === "active").length,
    inactiveRows: rows.filter((r) => r.status === "inactive").length,
    newItems,
    existingItems,
    newRates,
    unchangedRates,
    newCategories: [...newCategories],
    newTypes: [...newTypes],
    errors,
    warnings: all.length - errors,
    issues: all.slice(0, MAX_ISSUES_SHOWN),
    rows: errors === 0 ? rows : [],
  };
}
