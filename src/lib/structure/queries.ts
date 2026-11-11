import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CounterRow,
  OutletRow,
  OutletType,
  RecordStatus,
  StockPointRow,
  StockPointType,
  StructureData,
} from "./types";

type StockPointRecord = {
  id: string;
  code: string;
  name: string;
  type: StockPointType;
  status: RecordStatus;
};

type OutletRecord = {
  id: string;
  code: string;
  name: string;
  type: OutletType;
  status: RecordStatus;
  stock_point_id: string | null;
};

type CounterRecord = {
  id: string;
  outlet_id: string;
  name: string;
  status: RecordStatus;
};

// Row Level Security decides who may read these tables.
export async function loadStructure(): Promise<StructureData> {
  const supabase = await createClient();
  const [stockPointsResult, outletsResult, countersResult] = await Promise.all([
    supabase.from("stock_points").select("id, code, name, type, status").order("name"),
    supabase
      .from("outlets")
      .select("id, code, name, type, status, stock_point_id")
      .order("name"),
    supabase.from("counters").select("id, outlet_id, name, status").order("name"),
  ]);

  const stockPointRecords = (stockPointsResult.data ?? []) as StockPointRecord[];
  const outletRecords = (outletsResult.data ?? []) as OutletRecord[];
  const counterRecords = (countersResult.data ?? []) as CounterRecord[];

  const stockPointNames = new Map(stockPointRecords.map((sp) => [sp.id, sp.name]));
  const outletNames = new Map(outletRecords.map((o) => [o.id, o.name]));

  const stockPoints: StockPointRow[] = stockPointRecords.map((sp) => ({
    ...sp,
    outletNames: outletRecords
      .filter((o) => o.stock_point_id === sp.id)
      .map((o) => o.name),
  }));

  const outlets: OutletRow[] = outletRecords.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    type: o.type,
    status: o.status,
    stockPointId: o.stock_point_id,
    stockPointName: o.stock_point_id
      ? (stockPointNames.get(o.stock_point_id) ?? null)
      : null,
    sharesStockPoint:
      o.stock_point_id !== null &&
      outletRecords.some(
        (other) => other.id !== o.id && other.stock_point_id === o.stock_point_id,
      ),
    counterCount: counterRecords.filter((c) => c.outlet_id === o.id).length,
  }));

  const counters: CounterRow[] = counterRecords.map((c) => ({
    id: c.id,
    outletId: c.outlet_id,
    outletName: outletNames.get(c.outlet_id) ?? "",
    name: c.name,
    status: c.status,
  }));

  return { stockPoints, outlets, counters };
}
