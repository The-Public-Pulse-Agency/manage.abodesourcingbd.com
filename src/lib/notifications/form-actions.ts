"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { markRead, markAllRead } from "./notifications";

export type ActionResult = { error?: string };

export async function markReadAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  await markRead(actor, id);
  return {};
}

export async function markAllReadAction(): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  await markAllRead(actor);
  return {};
}
