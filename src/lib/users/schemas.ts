import { z } from "zod";
import { EMAIL_ROLES, isRole, type Role } from "@/lib/auth/roles";

// Messages are shown on the form, so they are written for the System Admin.
const roleField = z
  .string()
  .refine((value): value is Role => isRole(value) && EMAIL_ROLES.includes(value), {
    message: "Choose a role.",
  });

const fullName = z
  .string()
  .trim()
  .min(1, "Enter the full name.")
  .max(100, "The name is too long.");

const phone = z
  .string()
  .trim()
  .max(20, "The phone number is too long.")
  .regex(/^[0-9+\-\s()]*$/, "The phone number can only have digits, spaces, + and -.");

export const editUserSchema = z.object({
  fullName,
  phone,
  role: roleField,
});

export const createUserSchema = editUserSchema.extend({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "The email address is too long.")
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(10, "The temporary password needs at least 10 characters.")
    .max(72, "The temporary password is too long."),
});

export const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["active", "inactive"]),
});

export type UserFormState = {
  error: string | null;
  values: {
    fullName: string;
    phone: string;
    role: string;
    email: string;
  };
};
