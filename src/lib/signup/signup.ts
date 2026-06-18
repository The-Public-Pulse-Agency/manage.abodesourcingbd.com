import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { slugCode } from "@/lib/text";
import { seedTemplates } from "@/lib/tna/templates";
import { seedCompanyRoles } from "@/lib/auth/roles";

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

const MAX_SIGNUPS_PER_IP_PER_HOUR = 3;
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "trashmail.com",
  "yopmail.com", "getnada.com", "dispostable.com", "sharklasers.com", "maildrop.cc", "temp-mail.org",
]);

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
export async function signUp(
  input: SignUpInput,
  opts: { ip?: string | null; honeypot?: string } = {},
): Promise<{ companyId: string; email: string }> {
  // Bot honeypot — a hidden field real users never fill.
  if (opts.honeypot && opts.honeypot.trim()) throw new Error("Sign-up could not be completed.");

  const data = signUpSchema.parse(input);
  const email = data.email.toLowerCase().trim();

  // Block throwaway-email domains.
  if (DISPOSABLE_DOMAINS.has(email.split("@")[1] ?? "")) {
    throw new Error("Please use a permanent work email address.");
  }

  // Per-IP rate limit (DB-backed, serverless-safe).
  if (opts.ip) {
    const recent = await prisma.company.count({
      where: { signupIp: opts.ip, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
      throw new Error("Too many sign-ups from your network. Please try again later.");
    }
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error("An account with this email already exists — please sign in.");
  }

  const slug = await uniqueSlug(data.companyName);
  // Hash BEFORE the transaction so the slow bcrypt work never holds the tx open.
  const passwordHash = await hashPassword(data.password);
  const trialEnd = new Date(Date.now() + 30 * 86_400_000);

  // Provision the whole tenant atomically: a failure mid-seed rolls back entirely
  // rather than leaving a half-built, unrecoverable company (e.g. a company with no
  // admin, or an admin with no subscription/templates).
  const companyId = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: data.companyName.trim(), slug, signupIp: opts.ip ?? null } });
    const cid = company.id;
    await tx.user.create({ data: { name: data.name.trim(), email, role: "ADMIN", passwordHash, companyId: cid } });
    // 30-day trial subscription (id == companyId).
    await tx.subscription.create({ data: { id: cid, currentPeriodEnd: trialEnd } });
    // Seed defaults so the company can start immediately.
    await seedTemplates(cid, tx);
    await seedCompanyRoles(cid, tx);
    for (const [name, sizes] of Object.entries(DEFAULT_SCALES)) {
      await tx.sizeScale.create({
        data: { name, companyId: cid, sizes: { create: sizes.map((label, position) => ({ label, position, companyId: cid })) } },
      });
    }
    for (const name of DEFAULT_COLOURS) {
      await tx.colour.create({ data: { name, companyId: cid } });
    }
    return cid;
  });

  return { companyId, email };
}
