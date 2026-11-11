import { z } from "zod";

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
