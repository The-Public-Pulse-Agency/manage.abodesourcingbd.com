import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { normalizeMasterData, type RawRow } from "./normalize";

export type ImportSummary = {
  factories: number;
  buyers: number;
  brands: number;
  styles: number;
};

export async function importMasterData(
  actor: SessionUser,
  rows: RawRow[],
): Promise<ImportSummary> {
  assertPermission(actor, "masterData", "create");
  const data = normalizeMasterData(rows);

  for (const f of data.factories) {
    await prisma.factory.upsert({
      where: { code: f.code },
      update: {},
      create: { name: f.name, code: f.code },
    });
  }

  const buyerIdByCode = new Map<string, string>();
  for (const b of data.buyers) {
    const buyer = await prisma.buyer.upsert({
      where: { code: b.code },
      update: {},
      create: { name: b.name, code: b.code },
    });
    buyerIdByCode.set(b.code, buyer.id);
  }

  const brandIdByCode = new Map<string, string>();
  for (const br of data.brands) {
    const buyerId = buyerIdByCode.get(br.buyerCode);
    if (!buyerId) continue;
    const brand = await prisma.brand.upsert({
      where: { buyerId_code: { buyerId, code: br.code } },
      update: {},
      create: { buyerId, name: br.name, code: br.code },
    });
    brandIdByCode.set(br.code, brand.id);
  }

  for (const st of data.styles) {
    const brandId = brandIdByCode.get(st.brandCode);
    if (!brandId) continue;
    await prisma.style.upsert({
      where: { brandId_styleCode: { brandId, styleCode: st.styleCode } },
      update: {},
      create: { brandId, styleCode: st.styleCode, name: st.name },
    });
  }

  const summary: ImportSummary = {
    factories: data.factories.length,
    buyers: data.buyers.length,
    brands: data.brands.length,
    styles: data.styles.length,
  };
  await recordAudit({
    userId: actor.id,
    entityType: "Import",
    entityId: "master-data",
    action: "create",
    after: summary,
  });
  return summary;
}
