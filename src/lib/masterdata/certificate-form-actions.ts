"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { addCertificate, removeCertificate, updateCertificateField, updateFactoryRemarks, type CertField } from "./certificates";

export type ActionResult = { error?: string };

async function setField(id: string, field: CertField, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateCertificateField(actor, id, field, value);
    revalidatePath("/reports/factories");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update certificate" };
  }
}

export async function setCertificateName(id: string, value: string): Promise<ActionResult> { return setField(id, "name", value); }
export async function setCertificateNumber(id: string, value: string): Promise<ActionResult> { return setField(id, "number", value); }
export async function setCertificateValidUntil(id: string, value: string): Promise<ActionResult> { return setField(id, "validUntil", value); }

export async function setFactoryRemarksAction(factoryId: string, value: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await updateFactoryRemarks(actor, factoryId, value);
    revalidatePath("/reports/factories");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update remarks" };
  }
}

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
