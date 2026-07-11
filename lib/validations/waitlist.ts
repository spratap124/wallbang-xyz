import { z } from "zod";

export const waitlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be under 80 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email is too long."),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
