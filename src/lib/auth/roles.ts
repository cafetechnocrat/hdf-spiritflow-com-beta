// The nine roles. Safe to import in browser code (no secrets here).
export const ROLE_LABELS = {
  md: "MD",
  system_admin: "System Admin",
  chief_accountant: "Chief Accountant",
  accounts_staff: "Accounts Staff",
  night_accountant: "Night Accountant",
  cashier: "Cashier",
  stock_keeper: "Stock Keeper",
  security: "Security",
  kitchen_staff: "Kitchen Staff",
} as const;

export type Role = keyof typeof ROLE_LABELS;

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

// Roles that sign in with email and password. Cashiers use a username and PIN,
// which is added together with outlets and counters.
export const EMAIL_ROLES: Role[] = ROLES.filter((role) => role !== "cashier");

export function isRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}

// Short description shown under the role field on the user form.
export const ROLE_HINTS: Record<Role, string> = {
  md: "MD can view everything and change nothing.",
  system_admin: "System Admin manages users, outlets and counters.",
  chief_accountant: "Chief Accountant creates ledgers and sees all accounts.",
  accounts_staff: "Accounts Staff enter transactions and cannot create ledgers.",
  night_accountant: "Night Accountant has entry-only rights and no payments.",
  cashier: "Cashiers are limited to one outlet and counter.",
  stock_keeper: "Stock Keeper manages stock in later releases.",
  security: "Security uses attendance in a later release.",
  kitchen_staff: "Kitchen Staff see kitchen screens in a later release.",
};

// Roles that must also use an authenticator app (added in a later step).
export const TWO_FACTOR_ROLES: Role[] = [
  "md",
  "system_admin",
  "chief_accountant",
  "accounts_staff",
];
