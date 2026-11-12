// Access by user. Safe to import in browser code.

export type AccessFlags = { view: boolean; edit: boolean; delete: boolean };

// One feature as the Access section shows it: what it offers, what the role
// allows, and what this user has now (the role's access made narrower).
export type UserAccessFeature = {
  key: string;
  label: string;
  group: string;
  offersView: boolean;
  offersEdit: boolean;
  offersDelete: boolean;
  role: AccessFlags;
  user: AccessFlags;
};

export type UserAccessData = {
  userId: string;
  roleName: string;
  // A System Admin always has full access and cannot be reduced.
  isSystem: boolean;
  features: UserAccessFeature[];
};
