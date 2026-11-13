import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  ItemQuery,
  LiquorItemPage,
  LiquorItemRow,
  LiquorLookups,
  LookupRow,
  RateRow,
  RecordStatus,
} from "./types";

// PostgREST gives numeric columns as JSON numbers. Turn them into text with two
// decimals before anything reads them as money.
function amountText(value: number | string | null): string {
  return Number(value ?? 0).toFixed(2);
}

type ListRecord = {
  id: string;
  item_code: string;
  item_name: string;
  stock_name: string;
  type_id: string;
  type_name: string;
  category_id: string;
  category_name: string;
  volume_ml: number;
  bottles_per_case: number;
  peg_sale_allowed: boolean;
  status: RecordStatus;
  case_rate: number | string | null;
  fl1_price: number | string | null;
  cess_amount: number | string | null;
  rate_from: string | null;
  total_count: number | string;
};

// One page of items with the rate in force on the chosen date. The database
// filters, counts and pages them.
export async function loadItems(query: ItemQuery): Promise<LiquorItemPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("liquor_items_list", {
    p_as_on: query.asOn,
    p_search: query.q || null,
    p_category: query.category || null,
    p_type: query.type || null,
    p_volume: query.volume,
    p_peg: query.peg === null ? null : query.peg === "yes",
    p_status: query.status === "all" ? null : query.status,
    p_limit: query.size,
    p_offset: (query.page - 1) * query.size,
  });
  if (error) throw new Error("The items could not be loaded.");
  const records = (data ?? []) as ListRecord[];
  const rows: LiquorItemRow[] = records.map((r) => ({
    id: r.id,
    itemCode: r.item_code,
    itemName: r.item_name,
    stockName: r.stock_name,
    typeId: r.type_id,
    typeName: r.type_name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    volumeMl: r.volume_ml,
    bottlesPerCase: r.bottles_per_case,
    pegSaleAllowed: r.peg_sale_allowed,
    status: r.status,
    rate:
      r.rate_from === null
        ? null
        : {
            caseRate: amountText(r.case_rate),
            fl1Price: amountText(r.fl1_price),
            cessAmount: amountText(r.cess_amount),
            from: r.rate_from,
          },
  }));
  return { rows, total: records.length > 0 ? Number(records[0].total_count) : 0 };
}

type LookupRecord = {
  id: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  status: RecordStatus;
};

// The categories and types with how many items each holds.
export async function loadLookups(): Promise<LiquorLookups> {
  const supabase = await createClient();
  const [categories, types, counts] = await Promise.all([
    supabase.from("liquor_categories").select("id, name, sort_order, status"),
    supabase.from("liquor_types").select("id, name, description, status"),
    supabase.rpc("liquor_lookup_counts"),
  ]);
  const countMap = new Map<string, { items: number; active: number }>();
  for (const c of (counts.data ?? []) as {
    kind: string;
    id: string;
    items: number | string;
    active_items: number | string;
  }[]) {
    countMap.set(`${c.kind}:${c.id}`, { items: Number(c.items), active: Number(c.active_items) });
  }
  const build = (kind: string, records: LookupRecord[]): LookupRow[] =>
    records
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        sortOrder: r.sort_order ?? 0,
        status: r.status,
        items: countMap.get(`${kind}:${r.id}`)?.items ?? 0,
        activeItems: countMap.get(`${kind}:${r.id}`)?.active ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return {
    categories: build("category", (categories.data ?? []) as LookupRecord[]),
    types: build("type", (types.data ?? []) as LookupRecord[]),
  };
}

// Every rate row of one item, newest first.
export async function loadRates(itemId: string): Promise<RateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("liquor_item_rates")
    .select("id, effective_date, case_rate, fl1_price, cess_amount")
    .eq("item_id", itemId)
    .order("effective_date", { ascending: false });
  return ((data ?? []) as {
    id: string;
    effective_date: string;
    case_rate: number | string;
    fl1_price: number | string;
    cess_amount: number | string;
  }[]).map((r) => ({
    id: r.id,
    effectiveDate: r.effective_date,
    caseRate: amountText(r.case_rate),
    fl1Price: amountText(r.fl1_price),
    cessAmount: amountText(r.cess_amount),
  }));
}
