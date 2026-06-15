import { prisma } from "@/lib/db";
import { ForbiddenError, type SessionUser } from "@/lib/auth/guard";
import { initiateEps, verifyEps, isPaymentBlocked, epsConfigured, type InitiateResult } from "@/lib/eps";
import type { Subscription } from "@prisma/client";

const SUB_ID = "singleton";
const DAY = 86_400_000;

/** Only the platform owner (ADMIN) manages/pays the licence. */
function assertBillingAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Only an admin can manage billing");
}

/** The single org-level subscription row — lazily created (30-day trial) on first read. */
export async function getSubscription(opts: { now?: Date } = {}): Promise<Subscription> {
  const now = opts.now ?? new Date();
  return prisma.subscription.upsert({
    where: { id: SUB_ID },
    update: {},
    create: { id: SUB_ID, currentPeriodEnd: new Date(now.getTime() + 30 * DAY) },
  });
}

export function isActive(sub: Subscription, now: Date = new Date()): boolean {
  return sub.currentPeriodEnd.getTime() > now.getTime();
}

export function daysLeft(sub: Subscription, now: Date = new Date()): number {
  return Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / DAY);
}

export async function listSubscriptionPayments() {
  return prisma.subscriptionPayment.findMany({
    where: { subscriptionId: SUB_ID },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
}

/** Admin edits the plan — amount/period/name/notes are dynamic, not hardcoded. */
export async function updatePlan(
  actor: SessionUser,
  input: { amountBdt?: number; periodDays?: number; planName?: string; planNotes?: string; minMarginPct?: number },
): Promise<Subscription> {
  assertBillingAdmin(actor);
  await getSubscription();
  const data: Record<string, unknown> = {};
  if (input.amountBdt !== undefined && input.amountBdt > 0) data.amountBdt = Math.round(input.amountBdt);
  if (input.periodDays !== undefined && input.periodDays > 0) data.periodDays = Math.round(input.periodDays);
  if (input.planName) data.planName = input.planName.trim();
  if (input.planNotes !== undefined) data.planNotes = input.planNotes.trim();
  if (input.minMarginPct !== undefined && input.minMarginPct >= 0) data.minMarginPct = Math.round(input.minMarginPct);
  return prisma.subscription.update({ where: { id: SUB_ID }, data });
}

export type StartRenewalResult = InitiateResult & { orderId: string };

/** Create a pending renewal order + ask EPS for a hosted-checkout redirect URL. */
export async function startRenewal(actor: SessionUser, customerEmail: string): Promise<StartRenewalResult> {
  assertBillingAdmin(actor);
  const sub = await getSubscription();
  const orderId = `ABD-SUB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  await prisma.subscriptionPayment.create({
    data: {
      orderId,
      subscriptionId: SUB_ID,
      amountBdt: sub.amountBdt,
      status: isPaymentBlocked() || !epsConfigured() ? "BLOCKED" : "PENDING",
    },
  });
  const res = await initiateEps({
    orderId,
    amountBdt: sub.amountBdt,
    customerEmail,
    purpose: `${sub.planName} — ${sub.periodDays}-day renewal`,
  });
  return { ...res, orderId };
}

export type SettleResult = "paid" | "failed" | "already-paid" | "unknown" | "blocked";

/** Authoritatively settle a renewal: verify with EPS, then extend the period. Idempotent. */
export async function settleRenewal(orderId: string): Promise<SettleResult> {
  const verified = await verifyEps(orderId);
  if (!verified) return "blocked";
  const pay = await prisma.subscriptionPayment.findUnique({ where: { orderId } });
  if (!pay) return "unknown";
  if (pay.status === "PAID") return "already-paid";

  if (!verified.paid) {
    await prisma.subscriptionPayment.update({ where: { orderId }, data: { status: "FAILED", epsRef: verified.epsRef } });
    return "failed";
  }

  const sub = await getSubscription();
  const now = new Date();
  // Extend from the later of (now, currentPeriodEnd) so early renewals don't lose time.
  const base = sub.currentPeriodEnd.getTime() > now.getTime() ? sub.currentPeriodEnd : now;
  const newEnd = new Date(base.getTime() + sub.periodDays * DAY);
  await prisma.$transaction([
    prisma.subscriptionPayment.update({ where: { orderId }, data: { status: "PAID", epsRef: verified.epsRef, paidAt: now } }),
    prisma.subscription.update({ where: { id: SUB_ID }, data: { status: "ACTIVE", currentPeriodEnd: newEnd, lastPaymentAt: now } }),
  ]);
  return "paid";
}
