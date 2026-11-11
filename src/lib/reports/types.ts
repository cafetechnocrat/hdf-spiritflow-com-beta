// Report documents. Safe to import in browser code.
// One document model feeds the screen, the print view, Excel and PDF, so all
// of them show the same figures.

export const REPORT_KEYS = [
  "day-book",
  "ledger-statement",
  "trial-balance",
  "profit-loss",
  "balance-sheet",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

export const REPORT_TITLES: Record<ReportKey, string> = {
  "day-book": "Day Book",
  "ledger-statement": "Ledger Statement",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit And Loss",
  "balance-sheet": "Balance Sheet",
};

// A table cell. value is the plain number, used only for Excel cells.
export type Cell = { text: string; value?: number };

export type RowStyle = "normal" | "group" | "sub" | "ledger" | "subtotal" | "total" | "void";

export type DocRow = { cells: Cell[]; style: RowStyle };
export type DocColumn = { label: string; align: "left" | "right" };
export type DocTable = { heading?: string; columns: DocColumn[]; rows: DocRow[] };
export type DocKpi = { label: string; value: string; sub?: string };

// The Tally style layout of the Day Book.
export type DayBookBlock = {
  voucherId: string;
  title: string;
  referenceNo: string;
  date: string;
  void: boolean;
  lines: { side: "Dr" | "Cr"; name: string; amount: string }[];
  note: string;
};

export type ReportDocument = {
  key: ReportKey;
  title: string;
  hotelName: string;
  period: string;
  filters: string;
  generatedBy: string;
  generatedAt: string;
  kpis: DocKpi[];
  tables: DocTable[];
  notes: string[];
  // True when there is nothing to show for the chosen filters.
  empty: boolean;
  emptyTitle: string;
  emptyHint: string;
  blocks?: DayBookBlock[];
};

// What a filter bar needs. Values come from the database.
export type FilterOption = { value: string; label: string };
export type FilterField =
  | { kind: "date"; name: string; label: string; value: string }
  | { kind: "select"; name: string; label: string; value: string; options: FilterOption[] }
  | { kind: "check"; name: string; label: string; value: boolean };
