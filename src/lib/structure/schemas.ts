import { z } from "zod";
import { OUTLET_TYPES, STOCK_POINT_TYPES } from "./types";

// Messages are shown on the forms, so they are written for the System Admin.
const name = z
  .string()
  .trim()
  .min(1, "Enter the name.")
  .max(100, "The name is too long.");

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,10}$/, "The code can have letters and numbers only, up to 10.");

const status = z.enum(["active", "inactive"]);

export const idSchema = z.uuid();

export const stockPointSchema = z.object({
  name,
  code,
  type: z.enum(STOCK_POINT_TYPES, "Choose a type."),
  status,
});

export const outletSchema = z.object({
  name,
  code,
  type: z.enum(OUTLET_TYPES, "Choose a type."),
  // An empty value means no stock point.
  stockPointId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid("Choose a stock point.").nullable()),
  status,
});

export const counterSchema = z.object({
  outletId: z.uuid("Choose an outlet."),
  name,
  status,
});

export const statusChangeSchema = z.object({
  kind: z.enum(["stock_point", "outlet", "counter"]),
  id: idSchema,
  status,
});

export type StructureResult = { error: string | null };
