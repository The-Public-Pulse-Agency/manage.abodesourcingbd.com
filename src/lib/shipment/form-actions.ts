"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createShipment, updateShipment } from "./shipment";
import type { CreateShipmentInput, UpdateShipmentInput } from "./shipment";

export type ActionResult = { error?: string };

export async function createShipmentAction(input: CreateShipmentInput): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  let id: string;
  try {
    const shp = await createShipment(actor, input);
    id = shp.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create shipment" };
  }
  redirect(`/shipments/${id}`);
}

export async function updateShipmentAction(id: string, input: UpdateShipmentInput): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateShipment(actor, id, input);
    revalidatePath(`/shipments/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update shipment" };
  }
}
