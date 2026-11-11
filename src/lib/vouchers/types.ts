// Vouchers. Safe to import in browser code.

export type VoucherStatus = "posted" | "void";

export type VoucherTypeRow = {
  id: string;
  code: string;
  name: string;
  debitLabel: string;
  creditLabel: string;
  // Group ids (with everything under them) that each side may pick from.
  // null means any ledger.
  debitGroupIds: string[] | null;
  creditGroupIds: string[] | null;
};

export type LedgerChoice = {
  id: string;
  name: string;
  groupId: string;
};

export type VoucherRow = {
  id: string;
  voucherTypeId: string;
  typeName: string;
  referenceNo: string;
  date: string;
  reference: string | null;
  narration: string | null;
  status: VoucherStatus;
  editReason: string | null;
  voidReason: string | null;
  totalText: string;
  debitNames: string;
  creditNames: string;
};

export type VoucherEntryRow = {
  debitLedgerId: string;
  creditLedgerId: string;
  debitName: string;
  creditName: string;
  amountText: string;
};

// A ledger balance as on a date. side is null when the balance is zero. A
// balance that has gone the other way shows on the opposite side, with no sign.
export type LedgerBalance = {
  amountText: string;
  side: "dr" | "cr" | null;
};

export type VoucherData = {
  types: VoucherTypeRow[];
  ledgers: LedgerChoice[];
  vouchers: VoucherRow[];
  // True when the list was cut at the newest vouchers.
  truncated: boolean;
  // The date new vouchers start on, and today in India, as YYYY-MM-DD.
  transactionDate: string;
  today: string;
};
