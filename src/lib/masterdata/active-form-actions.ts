"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { setFactoryActive } from "./factory";
import { setPortActive, setForwarderActive } from "./logistics";

type Res = { error?: string };

export async function setFactoryActiveAction(id: string, active: boolean): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try { await setFactoryActive(actor, id, active); revalidatePath("/master-data/factories"); return {}; }
  catch (e) { return { error: e instanceof Error ? e.message : "Failed" }; }
}

export async function setPortActiveAction(id: string, active: boolean): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try { await setPortActive(actor, id, active); revalidatePath("/master-data/ports"); return {}; }
  catch (e) { return { error: e instanceof Error ? e.message : "Failed" }; }
}

export async function setForwarderActiveAction(id: string, active: boolean): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try { await setForwarderActive(actor, id, active); revalidatePath("/master-data/forwarders"); return {}; }
  catch (e) { return { error: e instanceof Error ? e.message : "Failed" }; }
}
