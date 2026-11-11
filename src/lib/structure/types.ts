// Stock points, outlets and counters. Safe to import in browser code.

export const STOCK_POINT_TYPES = ["warehouse", "bar", "kitchen", "restaurant"] as const;
export type StockPointType = (typeof STOCK_POINT_TYPES)[number];

export const STOCK_POINT_TYPE_LABELS: Record<StockPointType, string> = {
  warehouse: "Warehouse",
  bar: "Bar",
  kitchen: "Kitchen",
  restaurant: "Restaurant",
};

export const OUTLET_TYPES = ["bar", "restaurant", "front_office"] as const;
export type OutletType = (typeof OUTLET_TYPES)[number];

export const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  front_office: "Front Office",
};

export type RecordStatus = "active" | "inactive";

export type StockPointRow = {
  id: string;
  code: string;
  name: string;
  type: StockPointType;
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
