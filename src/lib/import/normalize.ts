import { normalizeName, slugCode } from "@/lib/text";

export type RawRow = { factory?: string; brand?: string; styleName?: string };

export type NormalizedFactory = { name: string; code: string };
export type NormalizedBuyer = { name: string; code: string };
export type NormalizedBrand = { buyerCode: string; name: string; code: string };
export type NormalizedStyle = { brandCode: string; styleCode: string; name: string };

export type NormalizedMasterData = {
  factories: NormalizedFactory[];
  buyers: NormalizedBuyer[];
  brands: NormalizedBrand[];
  styles: NormalizedStyle[];
};

const BUYER_ALIASES: Record<string, string> = { RALATEAM: "Ralawise", RALAWISE: "Ralawise" };

export function parseBrandField(value: string): { buyer: string; brand: string } {
  const [rawChannel, rawBrand] = value.split("-").map((s) => s.trim());
  const channelKey = slugCode(rawChannel ?? "");
  const buyer = BUYER_ALIASES[channelKey] ?? (rawChannel || value).trim();
  // For Ralawise channels the suffix is the brand (TRIDRI/AQ); otherwise the buyer IS the brand.
  const brand = BUYER_ALIASES[channelKey] ? (rawBrand ?? "").trim() : buyer;
  return { buyer, brand };
}

export function parseStyleName(styleName: string): { code: string; name: string } {
  const trimmed = styleName.trim();
  const match = trimmed.match(/^([A-Z]{2}\d{2,4}[A-Z]?)/);
  return { code: match ? match[1] : trimmed, name: trimmed };
}

export function normalizeMasterData(rows: RawRow[]): NormalizedMasterData {
  const factories = new Map<string, NormalizedFactory>();
  const buyers = new Map<string, NormalizedBuyer>();
  const brands = new Map<string, NormalizedBrand>();
  const styles = new Map<string, NormalizedStyle>();

  for (const row of rows) {
    if (row.factory && row.factory.trim()) {
      const name = row.factory.trim();
      factories.set(normalizeName(name), { name, code: slugCode(name) });
    }
    if (row.brand && row.brand.trim()) {
      const { buyer, brand } = parseBrandField(row.brand.trim());
      const buyerCode = slugCode(buyer);
      buyers.set(buyerCode, { name: buyer, code: buyerCode });
      if (brand) {
        const brandCode = slugCode(brand);
        brands.set(`${buyerCode}:${brandCode}`, { buyerCode, name: brand, code: brandCode });
        if (row.styleName && row.styleName.trim()) {
          const { code, name } = parseStyleName(row.styleName);
          styles.set(`${brandCode}:${code}`, { brandCode, styleCode: code, name });
        }
      }
    }
  }

  return {
    factories: [...factories.values()],
    buyers: [...buyers.values()],
    brands: [...brands.values()],
    styles: [...styles.values()],
  };
}
