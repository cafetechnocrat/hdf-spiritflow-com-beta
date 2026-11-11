import { z } from "zod";

// Messages are shown on the form, so they are written for the accountant.
export const idSchema = z.uuid();

const blankToNull = (value: string) => (value === "" ? null : value);

const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date from the calendar.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Choose the date from the calendar.");

const amount = z
  .string()
  .trim()
  .transform((value) => value.replace(/,/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter each amount like 1500.50, with at most two decimals.")
      .refine((value) => /[1-9]/.test(value), "Each amount must be more than zero."),
  );

export const entrySchema = z
  .object({
    debit: z.uuid("Choose the debit ledger on every row."),
    credit: z.uuid("Choose the credit ledger on every row."),
    amount,
  })
  .refine((row) => row.debit !== row.credit, {
    message: "The debit and credit ledgers of a row must be different.",
  });

export const voucherSchema = z.object({
  voucherId: z
    .string()
    .trim()
    .transform(blankToNull)
    .pipe(z.uuid().nullable()),
  typeId: z.uuid("Choose the voucher type."),
  date,
  reference: z.string().trim().max(100, "The reference is too long.").transform(blankToNull),
  narration: z.string().trim().max(500, "The narration is too long.").transform(blankToNull),
  reason: z.string().trim().max(300, "The reason is too long."),
  entries: z.array(entrySchema).min(1, "Add at least one row."),
});

export const voidSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(1, "Enter the reason.").max(300, "The reason is too long."),
});

export const transactionDateSchema = date;

export type VoucherResult = { error: string | null };

export type EntriesResult =
  | {
      error: null;
      entries: {
        debitLedgerId: string;
        creditLedgerId: string;
        debitName: string;
        creditName: string;
        amountText: string;
      }[];
    }
  | { error: string };
