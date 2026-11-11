// Ledger groups and ledgers. Safe to import in browser code.

export const ACCOUNT_NATURES = ["assets", "liabilities", "income", "expenses"] as const;
export type AccountNature = (typeof ACCOUNT_NATURES)[number];

export const ACCOUNT_NATURE_LABELS: Record<AccountNature, string> = {
  assets: "Assets",
  liabilities: "Liabilities",
  income: "Income",
  expenses: "Expenses",
};

// Income and expense ledgers start from nothing. Only assets and liabilities
// can carry an opening balance.
export function hasOpeningBalance(nature: AccountNature): boolean {
  return nature === "assets" || nature === "liabilities";
}

export const BALANCE_SIDES = ["dr", "cr"] as const;
export type BalanceSide = (typeof BALANCE_SIDES)[number];

export const BALANCE_SIDE_LABELS: Record<BalanceSide, string> = {
  dr: "Dr",
  cr: "Cr",
};

export type RecordStatus = "active" | "inactive";

export type LedgerGroupRow = {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  nature: AccountNature;
  isDefault: boolean;
  status: RecordStatus;
  // 0 for a primary group, 1 for a sub-group, and so on.
  depth: number;
  // Ledgers sitting directly in this group that are active.
  activeLedgerCount: number;
  activeChildCount: number;
};

export type LedgerRow = {
  id: string;
  name: string;
  alias: string | null;
  groupId: string;
  groupName: string;
  groupNature: AccountNature;
  // Display only. Never used for arithmetic.
  openingAmount: number;
  openingSide: BalanceSide;
  note: string | null;
  status: RecordStatus;
};

export type LedgerData = {
  groups: LedgerGroupRow[];
  ledgers: LedgerRow[];
};

export type LedgerKind = "group" | "ledger";
