import { z } from "zod";
import { SUPERADMIN_KEY } from "@/lib/auth/permissions";

// role is a role KEY referencing a company Role. SUPERADMIN is rejected here (a tenant ADMIN
// must never mint a cross-tenant platform operator); createUser/updateUser additionally verify
// the key resolves to a real Role in the actor's company.
const roleKey = z.string().min(1, "Role is required").refine((r) => r !== SUPERADMIN_KEY, "Invalid role");

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleKey,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: roleKey,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
