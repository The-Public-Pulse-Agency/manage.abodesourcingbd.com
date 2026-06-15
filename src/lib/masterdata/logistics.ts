import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createPortSchema = z.object({ name: z.string().min(1), country: z.string().optional() });
export const createForwarderSchema = z.object({ name: z.string().min(1), contact: z.string().optional() });

export async function createPort(actor: SessionUser, input: z.input<typeof createPortSchema>) {
  assertPermission(actor, "masterData", "create");
  const data = createPortSchema.parse(input);
  if (await prisma.port.findUnique({ where: { name: data.name } })) {
    throw new Error(`A port named ${data.name} already exists`);
  }
  const port = await prisma.port.create({ data });
  await recordAudit({ userId: actor.id, entityType: "Port", entityId: port.id, action: "create", after: { name: port.name } });
  return port;
}

export async function listPorts(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.port.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function createForwarder(actor: SessionUser, input: z.input<typeof createForwarderSchema>) {
  assertPermission(actor, "masterData", "create");
  const data = createForwarderSchema.parse(input);
  if (await prisma.forwarder.findUnique({ where: { name: data.name } })) {
    throw new Error(`A forwarder named ${data.name} already exists`);
  }
  const fwd = await prisma.forwarder.create({ data });
  await recordAudit({ userId: actor.id, entityType: "Forwarder", entityId: fwd.id, action: "create", after: { name: fwd.name } });
  return fwd;
}

export async function listForwarders(actor: SessionUser) {
  assertPermission(actor, "masterData", "view");
  return prisma.forwarder.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
