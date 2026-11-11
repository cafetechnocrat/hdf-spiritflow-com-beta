import type { Role } from "./roles";

// The permission matrix for the areas built so far, in one place.
// The database policies mirror it. The database is the real gate.
// V = view, E = create and edit.
type Access = "V" | "E";

export const PERMISSIONS = {
  dashboard: {
    md: "V",
    system_admin: "V",
    chief_accountant: "V",
    accounts_staff: "V",
    night_accountant: "V",
    cashier: "V",
    stock_keeper: "V",
    security: "V",
    kitchen_staff: "V",
  },
  users: {
    md: "V",
    system_admin: "E",
    chief_accountant: "V",
  },
  // Stock points, outlets and counters. Cashiers get their own outlet later.
  structure: {
    md: "V",
    system_admin: "E",
    chief_accountant: "V",
    accounts_staff: "V",
    night_accountant: "V",
    stock_keeper: "V",
    kitchen_staff: "V",
  },
  // Ledger groups and ledgers for the Day Book. The Night Accountant gets a
  // ledger list later, with the entry screens.
  ledgers: {
    md: "V",
    system_admin: "E",
    chief_accountant: "E",
    accounts_staff: "V",
  },
  // Transaction entry. Edit here means enter new vouchers.
  transactions: {
    md: "V",
    system_admin: "E",
    chief_accountant: "E",
    accounts_staff: "E",
  },
  // Editing or voiding a posted voucher. While the system is being built the
  // System Admin has every right, so it is allowed here too.
  voucher_changes: {
    system_admin: "E",
    chief_accountant: "E",
  },
  // Day Book reports. The Night Accountant has no reports.
  reports: {
    md: "V",
    system_admin: "V",
    chief_accountant: "V",
    accounts_staff: "V",
  },
  // Deleting a voucher for real. System Admin only, for development. Review
  // before the system goes live.
  voucher_delete: {
    system_admin: "E",
  },
} as const satisfies Record<string, Partial<Record<Role, Access>>>;

export type Area = keyof typeof PERMISSIONS;

function accessFor(area: Area, role: Role): Access | undefined {
  return (PERMISSIONS[area] as Partial<Record<Role, Access>>)[role];
}

export function canView(area: Area, role: Role): boolean {
  return accessFor(area, role) !== undefined;
}

export function canEdit(area: Area, role: Role): boolean {
  return accessFor(area, role) === "E";
}
