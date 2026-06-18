"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./guard";
import { createRole, updateRole, deleteRole } from "./roles";
import type { PermissionMap } from "./permissions";

type Res = { error?: string };

export async function createRoleAction(name: string, permissions: PermissionMap): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await createRole(actor, { name, permissions });
    revalidatePath("/roles");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create role" };
  }
}

export async function updateRoleAction(id: string, input: { name?: string; permissions?: PermissionMap }): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateRole(actor, id, input);
    revalidatePath("/roles");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update role" };
  }
}

export async function deleteRoleAction(id: string): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await deleteRole(actor, id);
    revalidatePath("/roles");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete role" };
  }
}
