"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type SessionUser } from "@/lib/auth/guard";
import { createDevelopment, updateDevelopmentField, deleteDevelopment, type DevField } from "./development";

type Res = { error?: string };

async function run(fn: (a: SessionUser) => Promise<void>): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await fn(actor);
    revalidatePath("/reports/development");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createDevelopmentAction(fd: FormData): Promise<Res> {
  return run(async (a) => {
    await createDevelopment(a, {
      buyerId: String(fd.get("buyerId") || "") || undefined,
      factoryId: String(fd.get("factoryId") || "") || undefined,
      styleRef: String(fd.get("styleRef") ?? ""),
      colour: String(fd.get("colour") || "") || undefined,
    });
  });
}

const setField = (id: string, f: DevField, value: string) => run((a) => updateDevelopmentField(a, id, f, value));

export async function setDevLabDip(id: string, value: string): Promise<Res> { return setField(id, "labDip", value); }
export async function setDevKnitting(id: string, value: string): Promise<Res> { return setField(id, "knitting", value); }
export async function setDevFirstSample(id: string, value: string): Promise<Res> { return setField(id, "firstSample", value); }
export async function setDevSecondSample(id: string, value: string): Promise<Res> { return setField(id, "secondSample", value); }
export async function setDevFinalSample(id: string, value: string): Promise<Res> { return setField(id, "finalSampleDate", value); }
export async function setDevRemarks(id: string, value: string): Promise<Res> { return setField(id, "remarks", value); }
export async function setDevColour(id: string, value: string): Promise<Res> { return setField(id, "colour", value); }
export async function setDevStyleRef(id: string, value: string): Promise<Res> { return setField(id, "styleRef", value); }
export async function setDevFactory(id: string, value: string): Promise<Res> { return setField(id, "factoryId", value); }
export async function setDevBuyer(id: string, value: string): Promise<Res> { return setField(id, "buyerId", value); }

export async function deleteDevelopmentAction(id: string): Promise<Res> {
  return run((a) => deleteDevelopment(a, id));
}
