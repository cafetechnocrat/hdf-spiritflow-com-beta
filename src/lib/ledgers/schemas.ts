import { z } from "zod";
import { BALANCE_SIDES } from "./types";

// Messages are shown on the forms, so they are written for the Chief Accountant.
const name = z
  .string()
  .trim()
  .min(1, "Enter the name.")
  .max(100, "The name is too long.");

// Ledger names use a plain hyphen with a space on each side, for example
// Sales - Liquor. Long dashes and slashes are not allowed.
const ledgerName = name.refine((value) => !/[–—/\\]/.test(value), {
  message: "Use a plain hyphen with a space on each side. No long dashes or slashes.",
});

const status = z.enum(["active", "inactive"]);

export const idSchema = z.uuid();

const blankToNull = (value: string) => (value === "" ? null : value);

export const groupSchema = z.object({
  name,
  parentId: z.uuid("Choose the group this one sits under."),
  status,
});

// A default group keeps its place. Only the name and status can change.
export const defaultGroupSchema = z.object({ name, status });

export const ledgerSchema = z.object({
  name: ledgerName,
  alias: z.string().trim().max(100, "The alias is too long.").transform(blankToNull),
  groupId: z.uuid("Choose a group."),
  // Kept as text so no floating point touches the money.
  openingAmount: z
    .string()
    .trim()
    .transform((value) => (value === "" ? "0" : value.replace(/,/g, "")))
    .pipe(
      z
        .string()
        .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter the opening balance as an amount, like 1500.50."),
    ),
  openingSide: z.enum(BALANCE_SIDES, "Choose Dr or Cr."),
  note: z.string().trim().max(500, "The note is too long.").transform(blankToNull),
  status,
});

export const statusChangeSchema = z.object({
  kind: z.enum(["group", "ledger"]),
  id: idSchema,
  status,
});

export type LedgerResult = { error: string | null };
