import { z } from "zod";

const status = z.enum(["active", "inactive"]);

const amount = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/,/g, ""))
    .pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, `Enter the ${label} as an amount, like 1500.50.`));

const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, `Enter the ${label} as a whole number.`)
    .transform(Number)
    .pipe(z.number().int().min(1, `The ${label} must be above 0.`).max(max, `The ${label} is too large.`));

const dateText = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)), {
    message: "Choose the date from the calendar.",
  });

export const itemSchema = z.object({
  itemCode: z.string().trim().min(1, "Enter the item code.").max(30, "The item code is too long."),
  itemName: z.string().trim().min(1, "Enter the BevCo item name.").max(200, "The item name is too long."),
  stockName: z.string().trim().min(1, "Enter the stock name.").max(200, "The stock name is too long."),
  typeId: z.uuid("Choose the type."),
  categoryId: z.uuid("Choose the category."),
  volumeMl: wholeNumber("volume", 10000),
  bottlesPerCase: wholeNumber("bottles per case", 500),
  pegSaleAllowed: z.enum(["yes", "no"]).transform((value) => value === "yes"),
  status,
});

export const rateSchema = z.object({
  itemId: z.uuid(),
  effectiveDate: dateText,
  caseRate: amount("case rate"),
  fl1Price: amount("FL1 shop price"),
});

export const lookupSchema = z.object({
  name: z.string().trim().min(1, "Enter the name.").max(60, "The name is too long."),
  description: z
    .string()
    .trim()
    .max(100, "The description is too long.")
    .transform((value) => (value === "" ? null : value)),
  sortOrder: z
    .string()
    .trim()
    .transform((value) => (value === "" ? "0" : value))
    .pipe(z.string().regex(/^\d{1,4}$/, "Enter the order as a whole number."))
    .transform(Number),
  status,
});

export const idSchema = z.uuid();
export { dateText };
