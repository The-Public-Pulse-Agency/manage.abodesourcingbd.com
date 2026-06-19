"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type SessionUser } from "@/lib/auth/guard";
import { createMovement, updateMovementField, deleteMovement, type MovementField } from "./sample-ledger";

type Res = { error?: string };

async function run(fn: (a: SessionUser) => Promise<void>): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await fn(actor);
    revalidatePath("/reports/sample-ledger");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createMovementAction(fd: FormData): Promise<Res> {
  return run(async (a) => {
    const direction = String(fd.get("direction") || "");
    await createMovement(a, {
      direction: direction === "OUT" ? "OUT" : "IN",
      movementDate: String(fd.get("movementDate") || "") || undefined,
      sampleType: String(fd.get("sampleType") || "") || undefined,
      qty: String(fd.get("qty") || "") || undefined,
      artNo: String(fd.get("artNo") ?? ""),
      buyer: String(fd.get("buyer") || "") || undefined,
      poNumber: String(fd.get("poNumber") || "") || undefined,
      factoryName: String(fd.get("factoryName") || "") || undefined,
      colour: String(fd.get("colour") || "") || undefined,
      receivedFrom: String(fd.get("receivedFrom") || "") || undefined,
      sentTo: String(fd.get("sentTo") || "") || undefined,
      courierName: String(fd.get("courierName") || "") || undefined,
      awbNumber: String(fd.get("awbNumber") || "") || undefined,
      remarks: String(fd.get("remarks") || "") || undefined,
    });
  });
}

const setField = (id: string, f: MovementField, value: string) => run((a) => updateMovementField(a, id, f, value));

export async function setMovementDate(id: string, value: string): Promise<Res> { return setField(id, "movementDate", value); }
export async function setMovementSampleType(id: string, value: string): Promise<Res> { return setField(id, "sampleType", value); }
export async function setMovementQty(id: string, value: string): Promise<Res> { return setField(id, "qty", value); }
export async function setMovementArtNo(id: string, value: string): Promise<Res> { return setField(id, "artNo", value); }
export async function setMovementBuyer(id: string, value: string): Promise<Res> { return setField(id, "buyer", value); }
export async function setMovementPoNumber(id: string, value: string): Promise<Res> { return setField(id, "poNumber", value); }
export async function setMovementFactory(id: string, value: string): Promise<Res> { return setField(id, "factoryName", value); }
export async function setMovementColour(id: string, value: string): Promise<Res> { return setField(id, "colour", value); }
export async function setMovementReceivedFrom(id: string, value: string): Promise<Res> { return setField(id, "receivedFrom", value); }
export async function setMovementSentTo(id: string, value: string): Promise<Res> { return setField(id, "sentTo", value); }
export async function setMovementCourier(id: string, value: string): Promise<Res> { return setField(id, "courierName", value); }
export async function setMovementAwb(id: string, value: string): Promise<Res> { return setField(id, "awbNumber", value); }
export async function setMovementRemarks(id: string, value: string): Promise<Res> { return setField(id, "remarks", value); }

export async function deleteMovementAction(id: string): Promise<Res> {
  return run((a) => deleteMovement(a, id));
}
