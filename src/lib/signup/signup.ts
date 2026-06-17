import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { slugCode } from "@/lib/text";
import { seedTemplates } from "@/lib/tna/templates";

export const signUpSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  name: z.string().min(1, "Your name is required"),
  email: z.string().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type SignUpInput = z.input<typeof signUpSchema>;

const DEFAULT_SCALES: Record<string, string[]> = {
  "Adult XS-6XL": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"],
  "Adult XS-2XL": ["XS", "S", "M", "L", "XL", "2XL"],
  Kids: ["3-4", "5-6", "7-8", "9-11", "12-13"],
};
const DEFAULT_COLOURS = ["Black", "White", "Navy", "Royal", "Red", "Bottle Green"];

/** Unique company slug from a name (append -2, -3… on collision). */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugCode(name).toLowerCase() || "company";
  let slug = base;
  for (let i = 2; await prisma.company.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

/**
 * Public self-serve onboarding: create a company, its first ADMIN, a 30-day trial
 * subscription, and seed the default critical-path template + size scales + colours.
 */
export async function signUp(input: SignUpInput): Promise<{ companyId: string; email: string }> {
  const data = signUpSchema.parse(input);
  const email = data.email.toLowerCase().trim();

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error("An account with this email already exists — please sign in.");
  }

  const slug = await uniqueSlug(data.companyName);
  const company = await prisma.company.create({ data: { name: data.companyName.trim(), slug } });
  const companyId = company.id;

  await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      role: "ADMIN",
      passwordHash: await hashPassword(data.password),
      companyId,
    },
  });

  // 30-day trial subscription (id == companyId).
  await prisma.subscription.create({
    data: { id: companyId, currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
  });

  // Seed defaults so the company can start immediately.
  await seedTemplates(companyId);
  for (const [name, sizes] of Object.entries(DEFAULT_SCALES)) {
    await prisma.sizeScale.create({
      data: { name, companyId, sizes: { create: sizes.map((label, position) => ({ label, position, companyId })) } },
    });
  }
  for (const name of DEFAULT_COLOURS) {
    await prisma.colour.create({ data: { name, companyId } });
  }

  return { companyId, email };
}
