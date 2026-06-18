"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { completeMilestone, rescheduleMilestone, setMilestoneNote } from "./milestones";

export type ActionResult = { error?: string };

export async function completeMilestoneAction(
  poId: string,
  milestoneId: string,
  dateISO: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date" };
  try {
    await completeMilestone(actor, milestoneId, date);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function rescheduleMilestoneAction(
  poId: string,
  milestoneId: string,
  dateISO: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date" };
  try {
    await rescheduleMilestone(actor, milestoneId, date);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setMilestoneNoteAction(
  poId: string,
  milestoneId: string,
  note: string,
): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await setMilestoneNote(actor, milestoneId, note);
    revalidatePath(`/orders/${poId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
