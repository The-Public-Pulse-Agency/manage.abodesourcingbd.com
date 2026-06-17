"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { addCertificate, removeCertificate } from "./certificates";

export type ActionResult = { error?: string };

export async function addCertificateAction(factoryId: string, fd: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await addCertificate(actor, {
      factoryId,
      name: String(fd.get("name") ?? ""),
      number: String(fd.get("number") || "") || undefined,
      validUntil: String(fd.get("validUntil") || "") || undefined,
    });
    revalidatePath("/reports/factories");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add certificate" };
  }
}

export async function removeCertificateAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await removeCertificate(actor, id);
    revalidatePath("/reports/factories");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
