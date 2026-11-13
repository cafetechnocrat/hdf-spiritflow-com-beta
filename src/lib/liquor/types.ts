// Liquor items, categories, types and the rate ledger. Safe to import in browser code.

export type RecordStatus = "active" | "inactive";

// Amounts from the database come as text, so no floating point touches money.
export type LiquorItemRow = {
  id: string;
  itemCode: string;
  itemName: string;
  stockName: string;
  typeId: string;
  typeName: string;
  categoryId: string;
  categoryName: string;
  volumeMl: number;
  bottlesPerCase: number;
  pegSaleAllowed: boolean;
  status: RecordStatus;
  // The rate in force on the chosen date. Null when no rate is in force yet.
  rate: { caseRate: string; fl1Price: string; cessAmount: string; from: string } | null;
};

export type LiquorItemPage = {
  rows: LiquorItemRow[];
  total: number;
};

export type LookupRow = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: RecordStatus;
  items: number;
  activeItems: number;
};

export type LiquorLookups = {
  categories: LookupRow[];
  types: LookupRow[];
};

export type RateRow = {
  id: string;
  effectiveDate: string;
  caseRate: string;
  fl1Price: string;
  cessAmount: string;
};

export const PAGE_SIZES = [10, 25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 10;

// The bottle sizes the list offers as a filter, in ml.
export const VOLUMES = [180, 250, 330, 375, 500, 650, 700, 750, 1000] as const;

// What the Items list asks for. All of it travels in the address.
export type ItemQuery = {
  q: string;
  category: string;
  type: string;
  volume: number | null;
  peg: "yes" | "no" | null;
  status: RecordStatus | "all";
  asOn: string;
  page: number;
  size: number;
};

export type LiquorResult = { error: string | null };
