"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type SessionUser } from "@/lib/auth/guard";
import { deleteFactory, deleteBuyer, deleteBrand, deleteStyle, deleteColour } from "./delete";

type Res = { error?: string };

async function run(path: string, fn: (a: SessionUser) => Promise<void>): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await fn(actor);
    revalidatePath(path);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Delete failed" };
  }
}

export async function deleteFactoryAction(id: string): Promise<Res> { return run("/master-data/factories", (a) => deleteFactory(a, id)); }
export async function deleteBuyerAction(id: string): Promise<Res> { return run("/master-data/buyers", (a) => deleteBuyer(a, id)); }
export async function deleteBrandAction(id: string): Promise<Res> { return run("/master-data/brands", (a) => deleteBrand(a, id)); }
export async function deleteStyleAction(id: string): Promise<Res> { return run("/master-data/styles", (a) => deleteStyle(a, id)); }
export async function deleteColourAction(id: string): Promise<Res> { return run("/master-data/colours", (a) => deleteColour(a, id)); }
