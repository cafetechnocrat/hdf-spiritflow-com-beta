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
} as const satisfies Record<string, Partial<Record<Role, Access>>>;

type Area = keyof typeof PERMISSIONS;

function accessFor(area: Area, role: Role): Access | undefined {
  return (PERMISSIONS[area] as Partial<Record<Role, Access>>)[role];
}

export function canView(area: Area, role: Role): boolean {
  return accessFor(area, role) !== undefined;
}

export function canEdit(area: Area, role: Role): boolean {
  return accessFor(area, role) === "E";
}
