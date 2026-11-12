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
  | "reports";

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
