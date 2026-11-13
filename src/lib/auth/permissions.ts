// What a signed in user may do. The access comes from the database (the roles,
// features and role_access tables), loaded with the user, never from a list in
// code. The database policies ask the same data through has_access().
// Safe to import in browser code.

// The features the code checks by name. Each one is a row in the features table.
export type FeatureKey =
  | "dashboard"
  | "users"
  | "structure"
  | "ledgers"
  | "transactions"
  | "voucher_changes"
  | "closing_stock"
  | "liquor_items"
  | "liquor_rates"
  | ReportFeature
  | DashboardFeature;

// Each report and each dashboard card is its own feature with one action, View.
// View off means the report or card is locked for that person.
export type ReportFeature =
  | "report_day_book"
  | "report_ledger_statement"
  | "report_sales_register"
  | "report_purchase_register"
  | "report_trial_balance"
  | "report_profit_loss"
  | "report_balance_sheet";

export type DashboardFeature =
  | "dash_sales"
  | "dash_purchases"
  | "dash_gross_profit"
  | "dash_cash_bank"
  | "dash_income_expenses"
  | "dash_sales_by_month"
  | "dash_cash_bank_balances"
  | "dash_receivables"
  | "dash_payables"
  | "dash_assets"
  | "dash_liabilities"
  | "dash_net_valuation"
  | "dash_latest_vouchers"
  | "dash_books_check";

// The lock that guards each report, by the report's address.
export const REPORT_FEATURES = {
  "day-book": "report_day_book",
  "ledger-statement": "report_ledger_statement",
  "sales-register": "report_sales_register",
  "purchase-register": "report_purchase_register",
  "trial-balance": "report_trial_balance",
  "profit-loss": "report_profit_loss",
  "balance-sheet": "report_balance_sheet",
} as const satisfies Record<string, ReportFeature>;

// True when the person may open at least one report.
export function canViewAnyReport(user: HasAccess): boolean {
  return Object.values(REPORT_FEATURES).some((feature) => canView(user, feature));
}

export type Action = "view" | "edit" | "delete";

// What one role may do on one feature.
export type FeatureAccess = { view: boolean; edit: boolean; delete: boolean };

// The access of a user's role, by feature key.
export type AccessMap = Record<string, FeatureAccess>;

// Anything that carries an access map, such as the signed in user.
type HasAccess = { access: AccessMap };

export function can(user: HasAccess, feature: FeatureKey, action: Action): boolean {
  return user.access[feature]?.[action] === true;
}

export function canView(user: HasAccess, feature: FeatureKey): boolean {
  return can(user, feature, "view");
}

export function canEdit(user: HasAccess, feature: FeatureKey): boolean {
  return can(user, feature, "edit");
}

export function canDelete(user: HasAccess, feature: FeatureKey): boolean {
  return can(user, feature, "delete");
}
