import { z } from "zod";

export const orderChannels = ["RALAWISE", "RALATEAM", "DIRECT"] as const;

export const createPoSchema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  buyerId: z.string().min(1),
  brandId: z.string().min(1),
  factoryId: z.string().min(1),
  channel: z.enum(orderChannels).default("DIRECT"),
  orderDate: z.coerce.date().optional(),
  crd: z.coerce.date().optional(),
  exFactoryDate: z.coerce.date().optional(),
  currency: z.string().min(1).default("USD"),
  notes: z.string().optional(),
});
// Use the INPUT type so callers may omit fields with defaults (channel, currency);
// `parse` applies the defaults and yields the fully-populated output type internally.
export type CreatePoInput = z.input<typeof createPoSchema>;

export const sizeRowSchema = z.object({
  label: z.string().min(1),
  qty: z.number().int().nonnegative(),
  netFob: z.number().nonnegative(),
  sellFob: z.number().nonnegative(),
});

export const setLineSchema = z
  .object({
    styleId: z.string().min(1),
    colourId: z.string().optional(),
    sizeScaleId: z.string().optional(),
    sizes: z.array(sizeRowSchema).min(1, "At least one size row required"),
  })
  .refine(
    (val) => {
      const labels = val.sizes.map((s) => s.label.trim());
      return new Set(labels).size === labels.length;
    },
    { message: "Duplicate size label in sizes", path: ["sizes"] },
  );
export type SetLineInput = z.infer<typeof setLineSchema>;

export const openOrderBookFilterSchema = z.object({
  factoryId: z.string().optional(),
  buyerId: z.string().optional(),
  channel: z.enum(orderChannels).optional(),
  exFactoryBefore: z.coerce.date().optional(),
});
export type OpenOrderBookFilter = z.infer<typeof openOrderBookFilterSchema>;
