"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canEdit } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  defaultGroupSchema,
  groupSchema,
  idSchema,
  ledgerSchema,
  statusChangeSchema,
  type LedgerResult,
} from "./schemas";
import type { LedgerKind } from "./types";

const text = {
  notAllowed: "You do not have permission to do this.",
  failed: "Something went wrong. Nothing was changed. Try again.",
  notFound: "That record was not found.",
  nameTaken: "That name is already used. Choose another.",
  inactiveFirst: "Make it inactive before deleting it.",
  nameMismatch: "The name you typed does not match. Nothing was deleted.",
  chooseGroup: "Choose the group this one sits under.",
  stillLinked: {
    group: "This group still has ledgers or sub-groups, so it cannot be deleted.",
    ledger: "This ledger is used in entries, so it cannot be deleted. Make it inactive instead.",
  },
} as const;

const TABLES = {
  group: "ledger_groups",
  ledger: "ledgers",
} as const satisfies Record<LedgerKind, string>;

const PATH = "/ledgers";

// Only the Chief Accountant may change these. The database enforces the same
// rule through Row Level Security, so this check is the first gate, not the only one.
async function requireChief() {
  const me = await getCurrentUser();
  return me && !me.mustChangePassword && canEdit("ledgers", me.role) ? me : null;
}

type DbError = { code?: string; message?: string } | null;

// Turns a database error into a message for the Chief Accountant.
function explain(error: NonNullable<DbError>, kind: LedgerKind): string {
  if (error.code === "23505") return text.nameTaken;
  if (error.code === "23503") return text.stillLinked[kind];
  // Rules written in the database raise their own readable message.
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return text.notAllowed;
  return text.failed;
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function saveGroup(
  _previous: LedgerResult,
  formData: FormData,
): Promise<LedgerResult> {
  const me = await requireChief();
  if (!me) return { error: text.notAllowed };

  const supabase = await createClient();
  const id = field(formData, "id");

  if (id) {
    const { data: existing } = await supabase
      .from("ledger_groups")
      .select("is_default")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return { error: text.notFound };

    // A default group keeps its place and nature. Only name and status change.
    if (existing.is_default) {
      const parsed = defaultGroupSchema.safeParse({
        name: field(formData, "name"),
        status: field(formData, "status"),
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? text.failed };
      }
      const { error } = await supabase.from("ledger_groups").update(parsed.data).eq("id", id);
      if (error) return { error: explain(error, "group") };
      revalidatePath(PATH);
      return { error: null };
    }
  }

  const parsed = groupSchema.safeParse({
    name: field(formData, "name"),
    parentId: field(formData, "parentId"),
    status: field(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  // The nature follows the group above, and the database checks it again.
  const { data: parent } = await supabase
    .from("ledger_groups")
    .select("nature")
    .eq("id", parsed.data.parentId)
    .maybeSingle();
  if (!parent) return { error: text.chooseGroup };

  const values = {
    name: parsed.data.name,
    parent_id: parsed.data.parentId,
    status: parsed.data.status,
  };
  const { error } = id
    ? await supabase.from("ledger_groups").update(values).eq("id", id)
    : await supabase
        .from("ledger_groups")
        .insert({ ...values, nature: parent.nature, created_by: me.id });
  if (error) return { error: explain(error, "group") };

  revalidatePath(PATH);
  return { error: null };
}

export async function saveLedger(
  _previous: LedgerResult,
  formData: FormData,
): Promise<LedgerResult> {
  const me = await requireChief();
  if (!me) return { error: text.notAllowed };

  const parsed = ledgerSchema.safeParse({
    name: field(formData, "name"),
    alias: field(formData, "alias"),
    groupId: field(formData, "groupId"),
    openingAmount: field(formData, "openingAmount"),
    openingSide: field(formData, "openingSide") || "dr",
    openingDate: field(formData, "openingDate"),
    note: field(formData, "note"),
    status: field(formData, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? text.failed };
  }

  const values = {
    name: parsed.data.name,
    alias: parsed.data.alias,
    group_id: parsed.data.groupId,
    opening_amount: parsed.data.openingAmount,
    opening_side: parsed.data.openingSide,
    opening_date: parsed.data.openingDate,
    note: parsed.data.note,
    status: parsed.data.status,
  };

  const id = field(formData, "id");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("ledgers").update(values).eq("id", id)
    : await supabase.from("ledgers").insert({ ...values, created_by: me.id });
  if (error) return { error: explain(error, "ledger") };

  revalidatePath(PATH);
  return { error: null };
}

// Activate or deactivate. The database refuses to deactivate a group that
// still has active ledgers or sub-groups.
export async function setLedgerStatus(
  _previous: LedgerResult,
  formData: FormData,
): Promise<LedgerResult> {
  const me = await requireChief();
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

// Permanent delete. Only an inactive record can be deleted, and its name must
// be typed. A default group is never deleted. The database refuses the delete
// while anything still points at the record, and the audit log keeps the old values.
export async function deleteLedgerItem(
  _previous: LedgerResult,
  formData: FormData,
): Promise<LedgerResult> {
  const me = await requireChief();
  if (!me) return { error: text.notAllowed };

  const kind = field(formData, "kind") as LedgerKind;
  if (!(kind in TABLES)) return { error: text.notFound };
  const id = field(formData, "id");
  if (!idSchema.safeParse(id).success) return { error: text.notFound };

  const supabase = await createClient();
  const table = TABLES[kind];
  const { data: record } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (!record) return { error: text.notFound };
  if (record.status !== "inactive") return { error: text.inactiveFirst };

  const typed = field(formData, "confirmName").trim();
  if (typed !== String(record.name).trim()) return { error: text.nameMismatch };

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: explain(error, kind) };

  revalidatePath(PATH);
  return { error: null };
}
