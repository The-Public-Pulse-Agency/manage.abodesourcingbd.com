import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/auth/permissions";

// Only company-scoped roles are assignable here — SUPERADMIN is excluded so a tenant
// ADMIN cannot mint a cross-tenant platform operator.
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ASSIGNABLE_ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(ASSIGNABLE_ROLES),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
