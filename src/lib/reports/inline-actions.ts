"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { updateOrderSchedule, deletePurchaseOrder } from "@/lib/orders/po";
import { closePurchaseOrder } from "@/lib/orders/close";
import { updateInvoiceFields } from "@/lib/finance/invoices";
import { updateShipment, updateShipmentLineQty, deleteShipment } from "@/lib/shipment/shipment";

type Res = { error?: string };

const parseDate = (v: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

function revalidate() {
  revalidatePath("/reports/open-orders");
  revalidatePath("/reports/shipped");
  revalidatePath("/shipments");
}

async function run(fn: (actorId: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<void>): Promise<Res> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Not authenticated" };
  try {
    await fn(actor);
    revalidate();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function setOrderShipDate(poId: string, value: string): Promise<Res> {
  return run((a) => updateOrderSchedule(a, poId, { exFactoryDate: parseDate(value) }));
}

export async function setOrderRecvDate(poId: string, value: string): Promise<Res> {
  return run((a) => updateOrderSchedule(a, poId, { orderDate: parseDate(value) }));
}

export async function setOrderRemarks(poId: string, value: string): Promise<Res> {
  return run((a) => updateOrderSchedule(a, poId, { notes: value }));
}

export async function setOrderCrd(poId: string, value: string): Promise<Res> {
  return run((a) => updateOrderSchedule(a, poId, { crd: parseDate(value) }));
}

export async function setShipmentRemarks(id: string, value: string): Promise<Res> {
  return run((a) => updateShipment(a, id, { remarks: value }).then(() => undefined));
}

export async function setShipmentTc(id: string, value: string): Promise<Res> {
  return run((a) => updateShipment(a, id, { tcStatus: value }).then(() => undefined));
}

export async function setShipmentTelex(id: string, value: string): Promise<Res> {
  return run((a) => updateShipment(a, id, { telexStatus: value as "PENDING" | "RECEIVED" | "RELEASED" }).then(() => undefined));
}

export async function setShipmentContainer(id: string, value: string): Promise<Res> {
  return run((a) => updateShipment(a, id, { containerNo: value }).then(() => undefined));
}

export async function setShipmentEta(id: string, value: string): Promise<Res> {
  return run((a) => updateShipment(a, id, { etaDestination: parseDate(value) }).then(() => undefined));
}

export async function setShipmentReference(id: string, value: string): Promise<Res> {
  return run((a) => updateShipment(a, id, { reference: value }).then(() => undefined));
}

export async function setShipmentLineSizeQty(shipmentLineSizeId: string, value: string): Promise<Res> {
  return run((a) => updateShipmentLineQty(a, shipmentLineSizeId, Math.trunc(Number(value))));
}

export async function setInvoiceValue(id: string, value: string): Promise<Res> {
  return run((a) => updateInvoiceFields(a, id, { amount: Math.max(0, Number(value) || 0) }));
}

export async function setInvoiceDue(id: string, value: string): Promise<Res> {
  return run((a) => updateInvoiceFields(a, id, { dueDate: parseDate(value) }));
}

export async function setInvoicePaymentStatus(id: string, value: string): Promise<Res> {
  return run((a) => updateInvoiceFields(a, id, { status: value }));
}

export async function deleteOrderAction(poId: string): Promise<Res> {
  return run((a) => deletePurchaseOrder(a, poId));
}

/** Short-close a shipped/partly-shipped order: any un-shipped balance becomes a short-ship,
 *  the order leaves the open book (status CLOSED). Used when the factory can't make the rest. */
export async function closeOrderAction(poId: string): Promise<Res> {
  return run((a) => closePurchaseOrder(a, poId).then(() => undefined));
}

export async function deleteShipmentAction(id: string): Promise<Res> {
  return run((a) => deleteShipment(a, id));
}
