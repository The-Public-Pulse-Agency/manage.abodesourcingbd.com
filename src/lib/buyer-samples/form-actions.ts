"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type SessionUser } from "@/lib/auth/guard";
import { createBuyerSample, updateBuyerSampleField, deleteBuyerSample, type BuyerSampleField } from "./buyer-samples";

type Res = { error?: string };

async function run(fn: (a: SessionUser) => Promise<void>): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await fn(actor);
    revalidatePath("/reports/buyer-samples");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createBuyerSampleAction(fd: FormData): Promise<Res> {
  return run(async (a) => {
    await createBuyerSample(a, {
      buyerName: String(fd.get("buyerName") || "") || undefined,
      sampleType: String(fd.get("sampleType") || "") || undefined,
      artNo: String(fd.get("artNo") ?? ""),
      styleName: String(fd.get("styleName") || "") || undefined,
      factoryName: String(fd.get("factoryName") || "") || undefined,
      courierName: String(fd.get("courierName") || "") || undefined,
      awbNumber: String(fd.get("awbNumber") || "") || undefined,
      sendDate: String(fd.get("sendDate") || "") || undefined,
      numSamples: String(fd.get("numSamples") || "") || undefined,
      approxArrival: String(fd.get("approxArrival") || "") || undefined,
      notes: String(fd.get("notes") || "") || undefined,
    });
  });
}

const setField = (id: string, f: BuyerSampleField, value: string) => run((a) => updateBuyerSampleField(a, id, f, value));

export async function setBuyerSampleBuyerName(id: string, value: string): Promise<Res> { return setField(id, "buyerName", value); }
export async function setBuyerSampleSampleType(id: string, value: string): Promise<Res> { return setField(id, "sampleType", value); }
export async function setBuyerSampleArtNo(id: string, value: string): Promise<Res> { return setField(id, "artNo", value); }
export async function setBuyerSampleStyleName(id: string, value: string): Promise<Res> { return setField(id, "styleName", value); }
export async function setBuyerSampleFactoryName(id: string, value: string): Promise<Res> { return setField(id, "factoryName", value); }
export async function setBuyerSampleCourierName(id: string, value: string): Promise<Res> { return setField(id, "courierName", value); }
export async function setBuyerSampleAwb(id: string, value: string): Promise<Res> { return setField(id, "awbNumber", value); }
export async function setBuyerSampleSendDate(id: string, value: string): Promise<Res> { return setField(id, "sendDate", value); }
export async function setBuyerSampleNumSamples(id: string, value: string): Promise<Res> { return setField(id, "numSamples", value); }
export async function setBuyerSampleApproxArrival(id: string, value: string): Promise<Res> { return setField(id, "approxArrival", value); }
export async function setBuyerSampleNotes(id: string, value: string): Promise<Res> { return setField(id, "notes", value); }

export async function deleteBuyerSampleAction(id: string): Promise<Res> {
  return run((a) => deleteBuyerSample(a, id));
}
