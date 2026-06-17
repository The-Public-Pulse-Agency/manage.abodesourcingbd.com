import type { TaStage } from "@prisma/client";

// Pure data only — no Prisma client / no `@/` imports — so the seed script can import
// this without pulling in the app's db singleton (avoids a dual-client hang).

export type TemplateDef = {
  key: string;
  name: string;
  stage: TaStage;
  offsetDays: number | null; // days relative to ex-factory; negative = before; null = manual
  position: number;
};

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  { key: "COSTING_PI", name: "Costing / PI approved", stage: "PRE_PRODUCTION", offsetDays: -75, position: 0 },
  { key: "FABRIC_BOOKED", name: "Yarn / fabric booked", stage: "PRE_PRODUCTION", offsetDays: -60, position: 1 },
  { key: "TRIMS_BOOKED", name: "Trims & accessories booked", stage: "PRE_PRODUCTION", offsetDays: -55, position: 2 },
  { key: "LAB_DIP", name: "Lab dip approved", stage: "SAMPLING", offsetDays: -55, position: 3 },
  { key: "KNITTING", name: "Knitting", stage: "SAMPLING", offsetDays: -52, position: 4 },
  { key: "FIRST_SAMPLE", name: "1st sample", stage: "SAMPLING", offsetDays: -50, position: 5 },
  { key: "SECOND_SAMPLE", name: "2nd sample", stage: "SAMPLING", offsetDays: -48, position: 6 },
  { key: "FIT_SAMPLE", name: "Fit sample approved", stage: "SAMPLING", offsetDays: -47, position: 7 },
  { key: "PP_SAMPLE", name: "PP sample approved", stage: "SAMPLING", offsetDays: -45, position: 8 },
  { key: "FINAL_SAMPLE", name: "Final sample sent", stage: "SAMPLING", offsetDays: -42, position: 9 },
  { key: "TOP_SAMPLE", name: "TOP / shipment sample", stage: "SAMPLING", offsetDays: -38, position: 10 },
  { key: "FABRIC_IN", name: "Bulk fabric in-house", stage: "PRODUCTION_QC", offsetDays: -30, position: 11 },
  { key: "CUTTING", name: "Cutting started", stage: "PRODUCTION_QC", offsetDays: -25, position: 12 },
  { key: "SEWING", name: "Sewing in progress", stage: "PRODUCTION_QC", offsetDays: -20, position: 13 },
  { key: "PRINT_EMB", name: "Print / embroidery", stage: "PRODUCTION_QC", offsetDays: -18, position: 14 },
  { key: "INLINE_INSP", name: "Inline inspection", stage: "PRODUCTION_QC", offsetDays: -12, position: 15 },
  { key: "FINAL_AQL", name: "Final AQL inspection", stage: "PRODUCTION_QC", offsetDays: -5, position: 16 },
  { key: "EX_FACTORY", name: "Ex-factory", stage: "SHIPPING", offsetDays: 0, position: 17 },
  { key: "BL_TELEX", name: "BL / Telex released", stage: "SHIPPING", offsetDays: 7, position: 18 },
  { key: "TC_SENT", name: "TC / test cert sent", stage: "SHIPPING", offsetDays: 10, position: 19 },
  { key: "PAYMENT", name: "Payment realised", stage: "SHIPPING", offsetDays: null, position: 20 },
];
