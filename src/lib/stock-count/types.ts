// Stock counts: physical stock taking by stock point and date. Quantities only.
// Safe to import in browser code.

export type CountPoint = { id: string; name: string; pegAllowed: boolean };

export type CountItem = {
  id: string;
  itemCode: string;
  itemName: string;
  stockName: string;
  volumeMl: number;
  categoryName: string;
  pegSaleAllowed: boolean;
};

// What was typed for one item. Kept as text so a half-typed number is not lost.
export type CountEntry = { b: string; p: string };

export type CountStatus = "draft" | "complete";

export type CountHeader = {
  id: string;
  status: CountStatus;
  // True once the count is posted to the accounts. It can then not be changed or deleted.
  posted: boolean;
  countedBy: string;
};

// The five rights, worked out from the user's role. The database checks them again.
export type CountRights = {
  take: boolean;
  save: boolean;
  exportFiles: boolean;
  viewValue: boolean;
  post: boolean;
  // Delete a count that is not posted yet.
  remove: boolean;
};

export type PastCount = {
  id: string;
  pointId: string;
  pointName: string;
  date: string;
  status: CountStatus;
  posted: boolean;
  countedBy: string;
  itemsCounted: number;
  itemsTotal: number;
  bottles: number;
  pegs: string;
  // Null for a person without the View Stock Value right, and for a Draft.
  value: string | null;
};

export type ValueLine = {
  pointId: string;
  pointName: string;
  status: "none" | "draft" | "complete";
  value: string | null;
};

export type PostPreview = {
  total: string;
  pointsTotal: number;
  pointsComplete: number;
  unpricedLines: number;
  hasExisting: boolean;
  existingValue: string | null;
};

export type CountResult = { error: string | null };

export type SaveResult =
  | { error: string }
  | { error: null; missing: number; saved: boolean };

export type PastFilters = {
  from: string;
  to: string;
  pointId: string;
  status: CountStatus | "";
};

// A bottle count is a whole number. Pegs can have a half, so up to two decimals.
export function isBottle(value: string): boolean {
  return /^\d{1,6}$/.test(value);
}

export function isPeg(value: string): boolean {
  return /^\d{1,4}(\.\d{1,2})?$/.test(value);
}

// Pegs are counted only where the stock point and the item both allow them.
export function needsPegs(point: CountPoint, item: CountItem): boolean {
  return point.pegAllowed && item.pegSaleAllowed;
}

// An item is counted when it has bottles, and pegs too where pegs are needed.
// Zero counts: it shows the item was looked at.
export function isCounted(point: CountPoint, item: CountItem, entry: CountEntry | undefined): boolean {
  if (!entry || !isBottle(entry.b)) return false;
  return needsPegs(point, item) ? isPeg(entry.p) : true;
}
