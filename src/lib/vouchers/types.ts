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

// What the Transactions list asks for. All of it travels in the address.
export type VoucherQuery = {
  from: string;
  to: string;
  type: string;
  status: "posted" | "void" | "all";
  q: string;
  page: number;
  size: number;
};

export type VoucherData = {
  types: VoucherTypeRow[];
  ledgers: LedgerChoice[];
  // One page of vouchers, newest first, and how many match the filters in all.
  vouchers: VoucherRow[];
  total: number;
  query: VoucherQuery;
  // The date new vouchers start on, and today in India, as YYYY-MM-DD.
  transactionDate: string;
  today: string;
};
