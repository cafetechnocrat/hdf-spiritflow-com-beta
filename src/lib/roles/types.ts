// Roles and access. Safe to import in browser code.

export type SignInMethod = "email" | "pin";

export type RoleRow = {
  id: string;
  name: string;
  // The one built-in role. It always has full access and cannot be changed.
  isSystem: boolean;
  isActive: boolean;
  requiresTwoFactor: boolean;
  signInMethod: SignInMethod;
  userCount: number;
};

// A feature access can be given to, with the actions it offers.
export type FeatureRow = {
  key: string;
  label: string;
  group: string;
  offersView: boolean;
  offersEdit: boolean;
  offersDelete: boolean;
};

export type AccessFlags = { view: boolean; edit: boolean; delete: boolean };

// Access by role id, then by feature key.
export type RoleAccessMap = Record<string, Record<string, AccessFlags>>;

export type RolesData = {
  roles: RoleRow[];
  features: FeatureRow[];
  access: RoleAccessMap;
};

export const NO_ACCESS: AccessFlags = { view: false, edit: false, delete: false };
