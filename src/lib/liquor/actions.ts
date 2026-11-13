"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit, canView } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { readImportFile, summariseImport, type ImportMode, type ImportSummary } from "./import";
import { loadRates } from "./queries";
import { idSchema, itemSchema, lookupSchema, rateSchema, dateText } from "./schemas";
import type { LiquorResult, RateRow } from "./types";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  notFound: "That record was not found.",
  codeTaken: "That item code is already used. Choose another.",
  nameTaken: "That name is already used. Choose another.",
  rateTaken: "A rate already starts on that date. Choose another date.",
  noFile: "Choose the Excel file first.",
  tooBig: "The file is too large.",
  needsErrorsFixed: "The file has errors. Fix them and check the file again.",
  nothingToImport: "There is nothing to import.",
} as const;

const PATH = "/liquor-items";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Rows saved per database call.
const BATCH_SIZE = 150;

type DbError = { code?: string; message?: string } | null;

function explain(error: NonNullable<DbError>, what: "item" | "lookup" | "rate"): string {
  if (error.code === "23505") {
    return what === "item" ? text.codeTaken : what === "rate" ? text.rateTaken : text.nameTaken;
  }
  if (error.code === "42501") return text.notAllowed;
  // Rules written in the database raise their own readable message.
  if (error.code === "P0001" && error.message) return error.message;
  return text.failed;
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

async function requireEdit(feature: "liquor_items" | "liquor_rates") {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit(me, feature) ? me : null;
}

// Adds or changes an item. A new item can come with its first rate.
export async function saveItem(formData: FormData): Promise<LiquorResult> {
  const me = await requireEdit("liquor_items");
  if (!me) return { error: text.notAllowed };

  const id = field(formData, "id");
  const parsed = itemSchema.safeParse({
    itemCode: field(formData, "itemCode"),
    itemName: field(formData, "itemName"),
    stockName: field(formData, "stockName"),
    typeId: field(formData, "typeId"),
    categoryId: field(formData, "categoryId"),
    volumeMl: field(formData, "volumeMl"),
    bottlesPerCase: field(formData, "bottlesPerCase"),
    pegSaleAllowed: field(formData, "pegSaleAllowed"),
    status: field(formData, "status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };
  const v = parsed.data;
  const values = {
    item_code: v.itemCode,
    item_name: v.itemName,
    stock_name: v.stockName,
    type_id: v.typeId,
    category_id: v.categoryId,
    volume_ml: v.volumeMl,
    bottles_per_case: v.bottlesPerCase,
    peg_sale_allowed: v.pegSaleAllowed,
    status: v.status,
  };

  const supabase = await createClient();

  if (id) {
    if (!idSchema.safeParse(id).success) return { error: text.notFound };
    const { error } = await supabase.from("liquor_items").update(values).eq("id", id);
    if (error) return { error: explain(error, "item") };
    revalidatePath(PATH);
    return { error: null };
  }

  // A new item needs its first rate. Check it before anything is saved.
  if (!canEdit(me, "liquor_rates")) return { error: text.notAllowed };
  const rate = rateSchema.safeParse({
    itemId: "00000000-0000-4000-8000-000000000000",
    effectiveDate: field(formData, "effectiveDate"),
    caseRate: field(formData, "caseRate"),
    fl1Price: field(formData, "fl1Price"),
  });
  if (!rate.success) return { error: rate.error.issues[0]?.message ?? text.failed };

  const { data: created, error } = await supabase
    .from("liquor_items")
    .insert(values)
    .select("id")
    .single();
  if (error || !created) return { error: error ? explain(error, "item") : text.failed };

  const { error: rateError } = await supabase.from("liquor_item_rates").insert({
    item_id: created.id,
    effective_date: rate.data.effectiveDate,
    case_rate: rate.data.caseRate,
    fl1_price: rate.data.fl1Price,
  });
  revalidatePath(PATH);
  if (rateError) {
    return {
      error: `The item was saved, but its first rate was not. Add the rate from the Rates screen. ${explain(rateError, "rate")}`,
    };
  }
  return { error: null };
}

// Adds a new dated rate row. An old row is never changed.
export async function saveRate(formData: FormData): Promise<LiquorResult> {
  const me = await requireEdit("liquor_rates");
  if (!me) return { error: text.notAllowed };
  const parsed = rateSchema.safeParse({
    itemId: field(formData, "itemId"),
    effectiveDate: field(formData, "effectiveDate"),
    caseRate: field(formData, "caseRate"),
    fl1Price: field(formData, "fl1Price"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const supabase = await createClient();
  const { error } = await supabase.from("liquor_item_rates").insert({
    item_id: parsed.data.itemId,
    effective_date: parsed.data.effectiveDate,
    case_rate: parsed.data.caseRate,
    fl1_price: parsed.data.fl1Price,
  });
  if (error) return { error: explain(error, "rate") };
  revalidatePath(PATH);
  return { error: null };
}

// The rate rows of one item, for the Rates screen.
export async function fetchRates(itemId: string): Promise<RateRow[]> {
  const me = await getCurrentUser();
  if (!me || !canView(me, "liquor_rates") || !idSchema.safeParse(itemId).success) return [];
  return loadRates(itemId);
}

// Adds or changes a category or a type.
export async function saveLookup(
  kind: "category" | "type",
  formData: FormData,
): Promise<LiquorResult> {
  const me = await requireEdit("liquor_items");
  if (!me) return { error: text.notAllowed };
  const parsed = lookupSchema.safeParse({
    name: field(formData, "name"),
    description: field(formData, "description"),
    sortOrder: field(formData, "sortOrder"),
    status: field(formData, "status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? text.failed };

  const id = field(formData, "id");
  if (id && !idSchema.safeParse(id).success) return { error: text.notFound };
  const supabase = await createClient();
  const { name, description, sortOrder, status } = parsed.data;
  const result =
    kind === "category"
      ? id
        ? await supabase
            .from("liquor_categories")
            .update({ name, sort_order: sortOrder, status })
            .eq("id", id)
        : await supabase
            .from("liquor_categories")
            .insert({ name, sort_order: sortOrder, status })
      : id
        ? await supabase.from("liquor_types").update({ name, description, status }).eq("id", id)
        : await supabase.from("liquor_types").insert({ name, description, status });
  if (result.error) return { error: explain(result.error, "lookup") };
  revalidatePath(PATH);
  return { error: null };
}

export type CheckResult = {
  error: string | null;
  summary: Omit<ImportSummary, "rows"> | null;
};

function readOptions(formData: FormData): {
  file: File | null;
  mode: ImportMode;
  effective: string | null;
} {
  const file = formData.get("file");
  const mode = field(formData, "mode") === "update" ? "update" : "first";
  const date = dateText.safeParse(field(formData, "effectiveDate"));
  return {
    file: file instanceof File && file.size > 0 ? file : null,
    mode,
    effective: date.success ? date.data : null,
  };
}

// Reads the file and shows what an import would do. Saves nothing.
export async function checkImport(formData: FormData): Promise<CheckResult> {
  const me = await requireEdit("liquor_items");
  if (!me || !canEdit(me, "liquor_rates")) return { error: text.notAllowed, summary: null };
  const { file, mode, effective } = readOptions(formData);
  if (!file) return { error: text.noFile, summary: null };
  if (file.size > MAX_FILE_BYTES) return { error: text.tooBig, summary: null };
  if (!effective) return { error: "Choose the date the rates are effective from.", summary: null };

  const read = await readImportFile(await file.arrayBuffer(), mode);
  if (read.fatal) return { error: read.fatal, summary: null };
  const { rows, ...summary } = await summariseImport(read.rows, read.issues, mode, effective);
  void rows;
  return { error: null, summary };
}

export type ImportResult = {
  error: string | null;
  done: { itemsAdded: number; ratesAdded: number; categoriesAdded: number; typesAdded: number } | null;
};

// Reads the file again and saves it in one go. The database rules still apply.
export async function runImport(formData: FormData): Promise<ImportResult> {
  const me = await requireEdit("liquor_items");
  if (!me || !canEdit(me, "liquor_rates")) return { error: text.notAllowed, done: null };
  const { file, mode, effective } = readOptions(formData);
  if (!file) return { error: text.noFile, done: null };
  if (file.size > MAX_FILE_BYTES) return { error: text.tooBig, done: null };
  if (!effective) return { error: "Choose the date the rates are effective from.", done: null };

  const read = await readImportFile(await file.arrayBuffer(), mode);
  if (read.fatal) return { error: read.fatal, done: null };
  const summary = await summariseImport(read.rows, read.issues, mode, effective);
  if (summary.errors > 0) return { error: text.needsErrorsFixed, done: null };
  if (summary.rows.length === 0) return { error: text.nothingToImport, done: null };

  // Saved in small batches, each its own transaction, so no single call runs past
  // the database time limit. Running the same file again is safe: items already
  // there are skipped and a rate is added only where it changed.
  const supabase = await createClient();
  const total = { itemsAdded: 0, ratesAdded: 0, categoriesAdded: 0, typesAdded: 0 };
  for (let start = 0; start < summary.rows.length; start += BATCH_SIZE) {
    const batch = summary.rows.slice(start, start + BATCH_SIZE);
    const { data, error } = await supabase.rpc("import_liquor_items", {
      p_rows: batch.map((r) => ({
        item_code: r.itemCode,
        item_name: r.itemName,
        stock_name: r.stockName,
        type: r.type,
        category: r.category,
        volume_ml: r.volumeMl,
        bottles_per_case: r.bottlesPerCase,
        peg_sale_allowed: r.pegSaleAllowed,
        status: r.status,
        case_rate: r.caseRate,
        fl1_price: r.fl1Price,
      })),
      p_effective: effective,
      p_first_load: mode === "first",
    });
    if (error) {
      console.error("import_liquor_items failed", error.code, error.message);
      const saved = total.itemsAdded + total.ratesAdded;
      const reason = explain(error, "item");
      return {
        error:
          saved > 0
            ? `The import stopped after saving ${total.itemsAdded} items and ${total.ratesAdded} rates. ${reason} (${error.code ?? "no code"}). Check the file again and import to continue.`
            : `${reason} (${error.code ?? "no code"}: ${error.message ?? ""})`,
        done: null,
      };
    }
    const result = (data as
      | { items_added: number; rates_added: number; categories_added: number; types_added: number }[]
      | null)?.[0];
    total.itemsAdded += result?.items_added ?? 0;
    total.ratesAdded += result?.rates_added ?? 0;
    total.categoriesAdded += result?.categories_added ?? 0;
    total.typesAdded += result?.types_added ?? 0;
  }
  revalidatePath(PATH);
  return { error: null, done: total };
}
