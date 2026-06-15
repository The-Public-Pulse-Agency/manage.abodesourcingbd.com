import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
