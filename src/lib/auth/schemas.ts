import { z } from "zod";

export const PASSWORD_MIN = 10;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(200),
    next: z
      .string()
      .min(PASSWORD_MIN, `The new password needs at least ${PASSWORD_MIN} characters.`)
      .max(72, "The new password is too long."),
    confirm: z.string(),
  })
  .refine((v) => v.next !== v.current, {
    message: "The new password must be different from the current password.",
    path: ["next"],
  })
  .refine((v) => v.next === v.confirm, {
    message: "The new passwords do not match.",
    path: ["confirm"],
  });

export const emailSignInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(254)
    .pipe(z.email()),
  password: z.string().min(1).max(200),
  keep: z.boolean(),
});
