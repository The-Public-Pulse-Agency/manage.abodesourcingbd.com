import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export const createPortSchema = z.object({ name: z.string().min(1, "Name is required"), country: z.string().optional() });
export const updatePortSchema = createPortSchema.partial();
export type UpdatePortInput = z.infer<typeof updatePortSchema>;
export const createForwarderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().optional(),
});
export type CreateForwarderInput = z.infer<typeof createForwarderSchema>;
export const updateForwarderSchema = createForwarderSchema.partial();
export type UpdateForwarderInput = z.infer<typeof updateForwarderSchema>;

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

export async function listPorts(
  actor: SessionUser,
  opts: { includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.port.findMany({
    where: opts.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getPort(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.port.findUnique({ where: { id } });
}

export async function updatePort(actor: SessionUser, id: string, input: UpdatePortInput) {
  assertPermission(actor, "masterData", "edit");
  const data = updatePortSchema.parse(input);
  let port;
  try {
    port = await prisma.port.update({ where: { id }, data });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error("A port with this name already exists");
    }
    throw e;
  }
  await recordAudit({ userId: actor.id, entityType: "Port", entityId: id, action: "edit", after: data });
  return port;
}

export async function setPortActive(actor: SessionUser, id: string, active: boolean) {
  assertPermission(actor, "masterData", "edit");
  const port = await prisma.port.update({ where: { id }, data: { active } });
  await recordAudit({ userId: actor.id, entityType: "Port", entityId: id, action: "edit", after: { active } });
  return port;
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

export async function listForwarders(
  actor: SessionUser,
  opts: { includeInactive?: boolean } = {},
) {
  assertPermission(actor, "masterData", "view");
  return prisma.forwarder.findMany({
    where: opts.includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getForwarder(actor: SessionUser, id: string) {
  assertPermission(actor, "masterData", "view");
  return prisma.forwarder.findUnique({ where: { id } });
}

export async function updateForwarder(actor: SessionUser, id: string, input: UpdateForwarderInput) {
  assertPermission(actor, "masterData", "edit");
  const data = updateForwarderSchema.parse(input);
  let fwd;
  try {
    fwd = await prisma.forwarder.update({ where: { id }, data });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error("A forwarder with this name already exists");
    }
    throw e;
  }
  await recordAudit({ userId: actor.id, entityType: "Forwarder", entityId: id, action: "edit", after: data });
  return fwd;
}

export async function setForwarderActive(actor: SessionUser, id: string, active: boolean) {
  assertPermission(actor, "masterData", "edit");
  const fwd = await prisma.forwarder.update({ where: { id }, data: { active } });
  await recordAudit({ userId: actor.id, entityType: "Forwarder", entityId: id, action: "edit", after: { active } });
  return fwd;
}
