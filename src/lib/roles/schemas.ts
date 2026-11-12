import { z } from "zod";

// Messages are shown on the forms, so they are written for the System Admin.
const name = z
  .string()
  .trim()
  .min(1, "Enter the role name.")
  .max(60, "The role name is too long.");

const signInMethod = z.enum(["email", "pin"], "Choose how this role signs in.");

export const idSchema = z.uuid();

export const createRoleSchema = z.object({
  name,
  signInMethod,
  // An empty value means start with no access.
  copyFromId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid("Choose a role to copy from.").nullable()),
});

export const updateRoleSchema = z.object({ id: idSchema, name, signInMethod });

export const switchSchema = z.object({
  id: idSchema,
  kind: z.enum(["active", "two_factor"]),
  value: z.boolean(),
});

export const accessSchema = z.object({
  roleId: idSchema,
  featureKey: z.string().regex(/^[a-z_]{1,40}$/, "That feature does not exist."),
  view: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

export type RoleResult = { error: string | null };
