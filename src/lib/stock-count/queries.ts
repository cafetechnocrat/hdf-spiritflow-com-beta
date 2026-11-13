import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CountEntry,
  CountHeader,
  CountItem,
  CountPoint,
  CountStatus,
  PastCount,
  PastFilters,
  PostPreview,
  ValueLine,
} from "./types";

// PostgREST gives numeric columns as JSON numbers. Turn them into text with two
// decimals before anything treats them as money.
const amountText = (value: number | string | null): string => Number(value ?? 0).toFixed(2);

// The stock points to count: the active Liquor stock points, read from the database.
export async function loadPoints(): Promise<CountPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count_points");
  if (error) throw new Error("The stock points could not be loaded.");
  return ((data ?? []) as { id: string; name: string; peg_allowed: boolean }[]).map((p) => ({
    id: p.id,
    name: p.name,
    pegAllowed: p.peg_allowed,
  }));
}

// The Active liquor items, read from the item master.
export async function loadItems(): Promise<CountItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count_items");
  if (error) throw new Error("The items could not be loaded.");
  return ((data ?? []) as {
    id: string;
    item_code: string;
    item_name: string;
    stock_name: string;
    volume_ml: number;
    category_name: string;
    peg_sale_allowed: boolean;
  }[]).map((i) => ({
    id: i.id,
    itemCode: i.item_code,
    itemName: i.item_name,
    stockName: i.stock_name,
    volumeMl: i.volume_ml,
    categoryName: i.category_name,
    pegSaleAllowed: i.peg_sale_allowed,
  }));
}

// The saved entries of one count, as the person typed them.
export async function loadCount(
  pointId: string,
  date: string,
): Promise<{ header: CountHeader | null; entries: Record<string, CountEntry> }> {
  const supabase = await createClient();
  const { data: head } = await supabase
    .from("stock_counts")
    .select("id, status, counted_by")
    .eq("stock_point_id", pointId)
    .eq("stock_date", date)
    .maybeSingle();
  if (!head) return { header: null, entries: {} };

  const entries: Record<string, CountEntry> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("stock_count_lines")
      .select("item_id, bottles, pegs")
      .eq("count_id", head.id)
      .order("item_id")
      .range(from, from + 999);
    const rows = (data ?? []) as { item_id: string; bottles: number | null; pegs: number | string | null }[];
    for (const r of rows) {
      entries[r.item_id] = {
        b: r.bottles === null ? "" : String(r.bottles),
        // Pegs come as a number. Drop a trailing .00 but keep a half.
        p: r.pegs === null ? "" : String(Number(r.pegs)),
      };
    }
    if (rows.length < 1000) break;
  }
  return {
    header: {
      id: head.id,
      status: head.status as CountStatus,
      countedBy: head.counted_by ?? "",
    },
    entries,
  };
}

type PastRecord = {
  id: string;
  stock_point_id: string;
  point_name: string;
  stock_date: string;
  status: CountStatus;
  counted_by: string | null;
  items_counted: number;
  items_total: number;
  bottles: number | string;
  pegs: number | string;
  value: number | string | null;
};

export async function loadPastCounts(filters: PastFilters): Promise<PastCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count_list", {
    p_from: filters.from,
    p_to: filters.to,
    p_point: filters.pointId || null,
    p_status: filters.status || null,
  });
  if (error) throw new Error("The counts could not be loaded.");
  return ((data ?? []) as PastRecord[]).map((r) => ({
    id: r.id,
    pointId: r.stock_point_id,
    pointName: r.point_name,
    date: r.stock_date,
    status: r.status,
    countedBy: r.counted_by ?? "",
    itemsCounted: r.items_counted,
    itemsTotal: r.items_total,
    bottles: Number(r.bottles),
    pegs: String(Number(r.pegs)),
    value: r.value === null ? null : amountText(r.value),
  }));
}

// Stock value of one date, stock point by stock point. Needs the View Stock Value right.
export async function loadValueSummary(date: string): Promise<ValueLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count_value_summary", { p_date: date });
  if (error) throw new Error("The stock value could not be loaded.");
  return ((data ?? []) as {
    stock_point_id: string;
    point_name: string;
    status: "none" | "draft" | "complete";
    value: number | string | null;
  }[]).map((r) => ({
    pointId: r.stock_point_id,
    pointName: r.point_name,
    status: r.status,
    value: r.value === null ? null : amountText(r.value),
  }));
}

// The first active stock account is where closing stock is posted.
export async function loadPostAccount(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("closing_stock_accounts");
  const first = ((data ?? []) as { id: string }[])[0];
  return first?.id ?? null;
}

export async function loadPostPreview(accountId: string, date: string): Promise<PostPreview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count_post_preview", {
    p_account: accountId,
    p_date: date,
  });
  if (error) throw new Error("The preview could not be loaded.");
  const r = ((data ?? []) as {
    total: number | string;
    points_total: number;
    points_complete: number;
    unpriced_lines: number;
    has_existing: boolean;
    existing_value: number | string | null;
  }[])[0];
  if (!r) throw new Error("The preview could not be loaded.");
  return {
    total: amountText(r.total),
    pointsTotal: r.points_total,
    pointsComplete: r.points_complete,
    unpricedLines: r.unpriced_lines,
    hasExisting: r.has_existing,
    existingValue: r.existing_value === null ? null : amountText(r.existing_value),
  };
}
