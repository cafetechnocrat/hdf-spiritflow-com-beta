"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  counterSchema,
  idSchema,
  outletSchema,
  statusChangeSchema,
  stockPointSchema,
  type StructureResult,
} from "./schemas";
import type { StructureKind } from "./types";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  notFound: "That record was not found.",
  codeTaken: "That code is already used. Choose another.",
  nameTaken: "That name is already used. Choose another.",
  counterTaken: "This outlet already has a counter with that name.",
  inactiveFirst: "Deactivate it before deleting it.",
  nameMismatch: "The name you typed does not match. Nothing was deleted.",
  stillLinked: {
    stock_point: "Outlets are still linked to this stock point, so it cannot be deleted.",
    outlet: "This outlet still has counters, so it cannot be deleted.",
    counter: "This counter is still in use, so it cannot be deleted.",
  },
} as const;

const TABLES = {
  stock_point: "stock_points",
  outlet: "outlets",
  counter: "counters",
} as const satisfies Record<StructureKind, string>;

const PATH = "/stock-outlets";

// Only the System Admin may change these. The database enforces the same rule
// through Row Level Security, so this check is the first gate, not the only one.
async function requireAdmin() {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit(me, "structure") ? me : null;
}

type DbError = { code?: string; message?: string; details?: string } | null;

// Turns a database error into a message for the System Admin.
function explain(error: NonNullable<DbError>, kind: StructureKind): string {
  if (error.code === "23505") {
    if (error.message?.includes("counters_outlet_name_key")) return text.counterTaken;
    if (error.message?.includes("_code_key")) return text.codeTaken;
    return text.nameTaken;
  }
  if (error.code === "23503") return text.stillLinked[kind];
  // Rules written in the database raise their own readable message.
  if (error.code === "P0001" && error.message) return error.message;
  return text.failed;
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function saveStockPoint(
  _previous: StructureResult,
  formData: FormData,
): Promise<StructureResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = stockPointSchema.safeParse({
    name: field(formData, "name"),
    code: field(formData, "code"),
    type: field(formData, "type"),
    pegAllowed: formData.get("pegAllowed") === "on",
    status: field(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  const { pegAllowed, ...rest } = parsed.data;
  const values = { ...rest, peg_allowed: pegAllowed };
  const id = field(formData, "id");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("stock_points").update(values).eq("id", id)
    : await supabase.from("stock_points").insert({ ...values, created_by: me.id });
  if (error) return { error: explain(error, "stock_point") };

  revalidatePath(PATH);
  return { error: null };
}

export async function saveOutlet(
  _previous: StructureResult,
  formData: FormData,
): Promise<StructureResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = outletSchema.safeParse({
    name: field(formData, "name"),
    code: field(formData, "code"),
    type: field(formData, "type"),
    stockPointId: field(formData, "stockPointId"),
    status: field(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  const { stockPointId, ...rest } = parsed.data;
  const values = { ...rest, stock_point_id: stockPointId };

  const id = field(formData, "id");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("outlets").update(values).eq("id", id)
    : await supabase.from("outlets").insert({ ...values, created_by: me.id });
  if (error) return { error: explain(error, "outlet") };

  revalidatePath(PATH);
  return { error: null };
}

export async function saveCounter(
  _previous: StructureResult,
  formData: FormData,
): Promise<StructureResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = counterSchema.safeParse({
    outletId: field(formData, "outletId"),
    name: field(formData, "name"),
    status: field(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  const values = {
    outlet_id: parsed.data.outletId,
    name: parsed.data.name,
    status: parsed.data.status,
  };

  const id = field(formData, "id");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("counters").update(values).eq("id", id)
    : await supabase.from("counters").insert({ ...values, created_by: me.id });
  if (error) return { error: explain(error, "counter") };

  revalidatePath(PATH);
  return { error: null };
}

// Activate or deactivate. The database refuses to deactivate a stock point
// that still has active outlets.
export async function setStructureStatus(
  _previous: StructureResult,
  formData: FormData,
): Promise<StructureResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const parsed = statusChangeSchema.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: text.notFound };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES[parsed.data.kind])
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return { error: explain(error, parsed.data.kind) };

  revalidatePath(PATH);
  return { error: null };
}

// Permanent delete. Only an inactive record can be deleted. Stock points and
// outlets need their name typed. The database refuses the delete while
// anything still points at the record, and the audit log keeps the old values.
export async function deleteStructure(
  _previous: StructureResult,
  formData: FormData,
): Promise<StructureResult> {
  const me = await requireAdmin();
  if (!me) return { error: text.notAllowed };

  const kind = field(formData, "kind") as StructureKind;
  if (!(kind in TABLES)) return { error: text.notFound };
  const id = field(formData, "id");
  if (!idSchema.safeParse(id).success) return { error: text.notFound };

  const supabase = await createClient();
  const table = TABLES[kind];
  const { data: record } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!record) return { error: text.notFound };
  if (record.status !== "inactive") return { error: text.inactiveFirst };

  if (kind !== "counter") {
    const typed = field(formData, "confirmName").trim();
    if (typed !== String(record.name).trim()) return { error: text.nameMismatch };
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: explain(error, kind) };

  revalidatePath(PATH);
  return { error: null };
}
