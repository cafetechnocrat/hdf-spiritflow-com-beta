// Closing stock. Safe to import in browser code. Amounts are text from the
// database (signed where a direction matters), so no floating point touches money.

export type StockAccount = {
  id: string;
  name: string;
  stockLedger: string;
  adjustmentLedger: string;
};

export type HistoryRow = {
  date: string;
  value: string;
  // Signed change posted for the day. Positive means stock went up.
  diff: string;
  voucherId: string | null;
  typeName: string | null;
  referenceNo: string | null;
  note: string | null;
};

export type ClosingStockData = {
  accounts: StockAccount[];
  selectedId: string;
  // The stock ledger balance as on `asOn`, signed text.
  bookNow: string;
  asOn: string;
  history: HistoryRow[];
  // Where the date field starts: the user's transaction date.
  startDate: string;
  canEdit: boolean;
  canChange: boolean;
  canOpenDayBook: boolean;
};

// What would happen if a value were saved for a date.
export type LaterChange = { date: string; from: string; to: string };

export type PreviewResult =
  | {
      ok: true;
      // Book stock before this day's journal, and the change it would post.
      bookBefore: string;
      diff: string;
      // True when this date already has a closing stock.
      existing: boolean;
      later: LaterChange[];
    }
  | { ok: false; error: string };

export type SaveResult = { error: string | null };
