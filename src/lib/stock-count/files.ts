import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { LOGO_HEIGHT, LOGO_PNG_BASE64, LOGO_WIDTH } from "@/lib/brand/logo-data";

// The count sheet as a PDF and an Excel file. Quantities only, never a value.
// The layout follows the standalone count tool's sheet: a header with the stock
// point block, category bands with their totals, a grand total, sign-off lines
// and a page footer.

export type SheetRow = {
  no: number;
  title: string;
  subtitle: string;
  bottles: number;
  // Null when pegs are not counted for the item.
  pegs: number | null;
};

export type SheetCategory = { name: string; rows: SheetRow[] };

export type CountSheet = {
  hotelName: string;
  pointName: string;
  // DD/MM/YYYY
  date: string;
  countedBy: string;
  itemsCounted: number;
  itemsTotal: number;
  pegsColumn: boolean;
  generatedBy: string;
  generatedAt: string;
  categories: SheetCategory[];
};

type RGB = [number, number, number];

const NAVY: RGB = [11, 31, 58];
const BLUE: RGB = [31, 95, 168];
const GREEN: RGB = [30, 142, 90];
const MUTED: RGB = [102, 116, 138];
const SOFT: RGB = [238, 243, 248];
const LINE: RGB = [227, 232, 239];
const TEXT: RGB = [27, 42, 65];

const pegText = (value: number) => String(Math.round(value * 10) / 10);
const title = (name: string) => name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function sheetFileName(sheet: CountSheet, extension: string): string {
  const point = sheet.pointName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [d, m, y] = sheet.date.split("/");
  return `HDF_Stock_Count_${point}_${y}-${m}-${d}.${extension}`;
}

type Meta =
  | { kind: "cat"; name: string; count: number }
  | { kind: "item"; row: SheetRow }
  | { kind: "catTotal" }
  | { kind: "gap" }
  | { kind: "grand" };

export function buildCountPdf(sheet: CountSheet): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = pageW - 14;
  const width = right - left;

  // Header ------------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text((sheet.hotelName || "Hotel").toUpperCase(), left, 17, { charSpace: 0.9 });
  doc.setFontSize(17);
  doc.setTextColor(...NAVY);
  doc.text("Physical Stock Count Sheet", left, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(`${sheet.pointName}  ·  Stock as on ${sheet.date}`, left, 31);

  // The Spirit Flow logo, top right.
  const logoW = 40;
  const logoH = (logoW * LOGO_HEIGHT) / LOGO_WIDTH;
  doc.addImage(`data:image/png;base64,${LOGO_PNG_BASE64}`, "PNG", right - logoW, 11, logoW, logoH);

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(left, 34.5, right, 34.5);

  // Information block ------------------------------------------------------------------
  const boxY = 38;
  const boxH = 12.5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(left, boxY, width, boxH, 1.5, 1.5);
  const cells: { label: string; value: string; color: RGB }[] = [
    { label: "STOCK POINT", value: sheet.pointName, color: NAVY },
    { label: "STOCK DATE", value: sheet.date, color: NAVY },
    { label: "COUNTED BY", value: sheet.countedBy || "-", color: NAVY },
    { label: "STATUS", value: `Complete  (${sheet.itemsCounted}/${sheet.itemsTotal})`, color: GREEN },
  ];
  const cellW = width / cells.length;
  cells.forEach((cell, i) => {
    const x = left + i * cellW;
    if (i > 0) doc.line(x, boxY + 1.8, x, boxY + boxH - 1.8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text(cell.label, x + 3, boxY + 4.6, { charSpace: 0.5 });
    doc.setFontSize(8.5);
    doc.setTextColor(...cell.color);
    doc.text(cell.value, x + 3, boxY + 9.4);
  });

  // The table -----------------------------------------------------------------------------
  const meta: Meta[] = [];
  const body: { content: string; colSpan?: number }[][] = [];
  const columns = sheet.pegsColumn ? 4 : 3;
  let allBottles = 0;
  let allPegs = 0;

  for (const category of sheet.categories) {
    const bottles = category.rows.reduce((sum, r) => sum + r.bottles, 0);
    const pegs = category.rows.reduce((sum, r) => sum + (r.pegs ?? 0), 0);
    allBottles += bottles;
    allPegs += pegs;
    meta.push({ kind: "cat", name: category.name, count: category.rows.length });
    body.push([{ content: "", colSpan: columns }]);
    for (const row of category.rows) {
      meta.push({ kind: "item", row });
      body.push([
        { content: String(row.no) },
        { content: "" },
        { content: String(row.bottles) },
        ...(sheet.pegsColumn ? [{ content: row.pegs === null ? "-" : pegText(row.pegs) }] : []),
      ]);
    }
    meta.push({ kind: "catTotal" });
    body.push([
      { content: "" },
      { content: `${title(category.name)} total` },
      { content: String(bottles) },
      ...(sheet.pegsColumn
        ? [{ content: category.rows.every((r) => r.pegs === null) ? "-" : pegText(pegs) }]
        : []),
    ]);
    meta.push({ kind: "gap" });
    body.push([{ content: "", colSpan: columns }]);
  }
  meta.push({ kind: "grand" });
  body.push([
    { content: "" },
    { content: `Total · ${sheet.pointName}` },
    { content: String(allBottles) },
    ...(sheet.pegsColumn ? [{ content: pegText(allPegs) }] : []),
  ]);

  const head = ["#", "ITEM (STOCK REPORT NAME · UOM)  /  BEVCO NAME · CODE", "BOTTLES"];
  if (sheet.pegsColumn) head.push("PEGS");

  autoTable(doc, {
    startY: boxY + boxH + 6,
    margin: { left, right: pageW - right, top: 16, bottom: 18 },
    head: [head],
    body,
    showHead: "everyPage",
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 }, textColor: TEXT, valign: "middle", lineWidth: 0 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 } },
    columnStyles: sheet.pegsColumn
      ? { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 24, halign: "right" }, 3: { cellWidth: 24, halign: "right" } }
      : { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 28, halign: "right" } },
    didParseCell: (hook) => {
      if (hook.section === "head") {
        if (hook.column.index >= 2) hook.cell.styles.halign = "right";
        if (hook.column.index === 1) hook.cell.styles.halign = "left";
        return;
      }
      const m = meta[hook.row.index];
      if (!m) return;
      if (m.kind === "cat") {
        hook.cell.styles.fillColor = SOFT;
        hook.cell.styles.minCellHeight = 7;
      } else if (m.kind === "item") {
        hook.cell.styles.minCellHeight = 8.6;
        if (hook.column.index === 0) {
          hook.cell.styles.textColor = [150, 163, 181];
          hook.cell.styles.fontSize = 7;
        }
        if (hook.column.index >= 2) {
          hook.cell.styles.fontStyle = "bold";
          hook.cell.styles.fontSize = 8.5;
          hook.cell.styles.textColor = NAVY;
          if (hook.column.index === 3 && sheet.pegsColumn && m.row.pegs === null) {
            hook.cell.styles.fontStyle = "normal";
            hook.cell.styles.textColor = [170, 180, 195];
          }
        }
      } else if (m.kind === "catTotal") {
        hook.cell.styles.textColor = BLUE;
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.minCellHeight = 7;
      } else if (m.kind === "gap") {
        hook.cell.styles.minCellHeight = 4;
        hook.cell.styles.cellPadding = 0;
      } else if (m.kind === "grand") {
        hook.cell.styles.fillColor = NAVY;
        hook.cell.styles.textColor = [255, 255, 255];
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fontSize = 9;
        hook.cell.styles.minCellHeight = 8;
      }
    },
    didDrawCell: (hook) => {
      if (hook.section !== "body") return;
      const m = meta[hook.row.index];
      if (!m) return;
      const { x, y, width: w, height: h } = hook.cell;
      if (m.kind === "cat" && hook.column.index === 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...NAVY);
        doc.text(m.name, x + 2, y + h / 2 + 1);
        const nameW = doc.getTextWidth(m.name);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(`${m.count} items`, x + 2 + nameW + 3, y + h / 2 + 1);
        doc.setDrawColor(...BLUE);
        doc.setLineWidth(0.4);
        doc.line(x, y + h, x + w, y + h);
      } else if (m.kind === "item") {
        if (hook.column.index === 1) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.2);
          doc.setTextColor(...NAVY);
          doc.text(m.row.title, x + 2, y + 3.7);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(...MUTED);
          doc.text(m.row.subtitle, x + 2, y + 6.9);
        }
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(x, y + h, x + w, y + h);
      }
    },
  });

  // Sign-off lines -----------------------------------------------------------------------------
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let y = (last?.finalY ?? 60) + 14;
  if (y > pageH - 18 - 44) {
    doc.addPage();
    y = 22;
  }
  const colW = (width - 12) / 3;
  const labels: { label: string; hint: string; name?: string }[] = [
    { label: "Counted by", hint: "Signature & date", name: sheet.countedBy },
    { label: "Verified by", hint: "Name, signature & date" },
    { label: "Approved by", hint: "Name, signature & date" },
  ];
  labels.forEach((item, i) => {
    const x = left + i * (colW + 6);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.line(x, y + 16, x + colW, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(item.label, x, y + 20);
    if (item.name) {
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(item.name, x, y + 25);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(item.hint, x, y + (item.name ? 28.5 : 24));
  });
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text(
    `Generated by ${sheet.generatedBy} on ${sheet.generatedAt}. Quantities only, no values. Items that do not allow peg sale are counted in bottles only.`,
    left,
    y + 36,
  );

  // Footer on every page ------------------------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(left, pageH - 14, right, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text("Spirit Flow · Physical stock count", left, pageH - 10);
    doc.text(`${sheet.pointName} · ${sheet.date}`, pageW / 2, pageH - 10, { align: "center" });
    doc.text(`Page ${p} of ${pages}`, right, pageH - 10, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function buildCountExcel(sheet: CountSheet): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Stock Count", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    views: [{ state: "frozen", ySplit: 7 }],
  });
  const lastCol = sheet.pegsColumn ? 5 : 4;
  const navy = "FF0B1F3A";
  const soft = "FFEEF3F8";
  ws.columns = [
    { width: 6 },
    { width: 48 },
    { width: 62 },
    { width: 12 },
    ...(sheet.pegsColumn ? [{ width: 12 }] : []),
  ];

  const merged = (row: number, value: string, font: Partial<ExcelJS.Font>) => {
    ws.mergeCells(row, 1, row, lastCol);
    const cell = ws.getCell(row, 1);
    cell.value = value;
    cell.font = { name: "Calibri", ...font };
    cell.alignment = { vertical: "middle" };
  };
  // The Spirit Flow logo, top right, over the empty part of the first rows.
  const logo = workbook.addImage({ base64: LOGO_PNG_BASE64, extension: "png" });
  ws.addImage(logo, {
    tl: { col: sheet.pegsColumn ? 2.45 : 2.45, row: 0.15 },
    ext: { width: 190, height: Math.round((190 * LOGO_HEIGHT) / LOGO_WIDTH) },
  });
  merged(1, (sheet.hotelName || "Hotel").toUpperCase(), { size: 9, bold: true, color: { argb: "FF66748A" } });
  merged(2, "Physical Stock Count Sheet", { size: 16, bold: true, color: { argb: navy } });
  merged(3, `${sheet.pointName}  ·  Stock as on ${sheet.date}`, { size: 10, color: { argb: "FF1B2A41" } });
  merged(4, `Counted by: ${sheet.countedBy || "-"}    Status: Complete (${sheet.itemsCounted}/${sheet.itemsTotal})`, { size: 10, color: { argb: "FF1E8E5A" }, bold: true });
  ws.getRow(2).height = 24;

  const headRow = ws.getRow(7);
  const heads = ["#", "Item", "BevCo Name · Code", "Bottles", ...(sheet.pegsColumn ? ["Pegs"] : [])];
  heads.forEach((h, i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    cell.alignment = { horizontal: i >= 3 ? "right" : "left", vertical: "middle" };
  });
  headRow.height = 20;
  ws.pageSetup.printTitlesRow = "7:7";

  let r = 8;
  let allBottles = 0;
  let allPegs = 0;
  for (const category of sheet.categories) {
    const bottles = category.rows.reduce((sum, x) => sum + x.bottles, 0);
    const pegs = category.rows.reduce((sum, x) => sum + (x.pegs ?? 0), 0);
    allBottles += bottles;
    allPegs += pegs;

    ws.mergeCells(r, 1, r, lastCol);
    const band = ws.getCell(r, 1);
    band.value = `${category.name}   ${category.rows.length} items`;
    band.font = { name: "Calibri", bold: true, size: 10, color: { argb: navy } };
    band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: soft } };
    band.border = { bottom: { style: "medium", color: { argb: "FF1F5FA8" } } };
    r += 1;

    for (const row of category.rows) {
      const line = ws.getRow(r);
      line.getCell(1).value = row.no;
      line.getCell(1).font = { name: "Calibri", size: 9, color: { argb: "FF96A3B5" } };
      line.getCell(2).value = row.title;
      line.getCell(2).font = { name: "Calibri", bold: true, size: 10, color: { argb: navy } };
      line.getCell(3).value = row.subtitle.replace(/^\(|\)$/g, "");
      line.getCell(3).font = { name: "Calibri", size: 9, color: { argb: "FF66748A" } };
      line.getCell(4).value = row.bottles;
      line.getCell(4).font = { name: "Calibri", bold: true, size: 10, color: { argb: navy } };
      if (sheet.pegsColumn) {
        const peg = line.getCell(5);
        if (row.pegs === null) {
          peg.value = "-";
          peg.font = { name: "Calibri", size: 10, color: { argb: "FFAAB4C3" } };
        } else {
          peg.value = row.pegs;
          peg.numFmt = "0.0";
          peg.font = { name: "Calibri", bold: true, size: 10, color: { argb: navy } };
        }
        peg.alignment = { horizontal: "right" };
      }
      line.getCell(4).alignment = { horizontal: "right" };
      for (let c = 1; c <= lastCol; c += 1) {
        line.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFE3E8EF" } } };
      }
      r += 1;
    }

    const total = ws.getRow(r);
    total.getCell(2).value = `${title(category.name)} total`;
    total.getCell(4).value = bottles;
    if (sheet.pegsColumn) {
      total.getCell(5).value = pegs;
      total.getCell(5).numFmt = "0.0";
    }
    for (let c = 1; c <= lastCol; c += 1) {
      total.getCell(c).font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF1F5FA8" } };
      if (c >= 4) total.getCell(c).alignment = { horizontal: "right" };
    }
    r += 2;
  }

  const grand = ws.getRow(r);
  grand.getCell(2).value = `Total · ${sheet.pointName}`;
  grand.getCell(4).value = allBottles;
  if (sheet.pegsColumn) {
    grand.getCell(5).value = allPegs;
    grand.getCell(5).numFmt = "0.0";
  }
  for (let c = 1; c <= lastCol; c += 1) {
    const cell = grand.getCell(c);
    cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    if (c >= 4) cell.alignment = { horizontal: "right" };
  }
  r += 2;
  ws.mergeCells(r, 1, r, lastCol);
  const foot = ws.getCell(r, 1);
  foot.value = `Generated by ${sheet.generatedBy} on ${sheet.generatedAt}. Quantities only, no values.`;
  foot.font = { name: "Calibri", size: 8, color: { argb: "FF66748A" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
