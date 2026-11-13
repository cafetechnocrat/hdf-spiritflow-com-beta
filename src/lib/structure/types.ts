// Stock points, outlets and counters. Safe to import in browser code.

// A stock point holds one kind of item: liquor, kitchen items or house keeping items.
export const STOCK_POINT_TYPES = ["liquor", "kitchen", "housekeeping"] as const;
export type StockPointType = (typeof STOCK_POINT_TYPES)[number];

export const STOCK_POINT_TYPE_LABELS: Record<StockPointType, string> = {
  liquor: "Liquor",
  kitchen: "Kitchen",
  housekeeping: "House Keeping",
};

// Only a Liquor stock point can allow peg sale.
export function canAllowPegs(type: StockPointType): boolean {
  return type === "liquor";
}

export const OUTLET_TYPES = ["liquor", "food", "hospitality"] as const;
export type OutletType = (typeof OUTLET_TYPES)[number];

export const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  liquor: "Liquor",
  food: "Food",
  hospitality: "Hospitality",
};

export type RecordStatus = "active" | "inactive";

export type StockPointRow = {
  id: string;
  code: string;
  name: string;
  type: StockPointType;
  // True when stock is counted in pegs as well as bottles. Liquor only.
  pegAllowed: boolean;
  status: RecordStatus;
  // Names of the outlets that sell from this stock point.
  outletNames: string[];
};

export type OutletRow = {
  id: string;
  code: string;
  name: string;
  type: OutletType;
  status: RecordStatus;
  stockPointId: string | null;
  stockPointName: string | null;
  // True when another outlet uses the same stock point.
  sharesStockPoint: boolean;
  counterCount: number;
};

export type CounterRow = {
  id: string;
  outletId: string;
  outletName: string;
  name: string;
  status: RecordStatus;
};

export type StructureData = {
  stockPoints: StockPointRow[];
  outlets: OutletRow[];
  counters: CounterRow[];
};

export type StructureKind = "stock_point" | "outlet" | "counter";
