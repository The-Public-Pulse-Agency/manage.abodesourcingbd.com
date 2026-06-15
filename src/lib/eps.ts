import crypto from "node:crypto";

/**
 * EPS (eps.com.bd) payment gateway — adapted from the proven ThePulseToday integration,
 * per the official EPS SDK (github.com/EPS-PG/EPS_Nodejs):
 *   - token:    POST /v1/Auth/GetToken                         (x-hash of userName)        → data.token
 *   - initiate: POST /v1/EPSEngine/InitializeEPS               (x-hash of mTxnId + Bearer) → RedirectURL
 *   - verify:   GET  /v1/EPSEngine/CheckMerchantTransactionStatus (x-hash + Bearer)        → Status
 *   - x-hash = base64(HMAC-SHA512(EPS_HASH_KEY, value))
 *
 * SAFETY INVARIANT: when STAGING_PAYMENT_BLOCK=1 (default), this HARD-REFUSES to charge.
 * Set it to "0" + provide EPS creds only in production. Creds live in env, never git.
 */

export const isPaymentBlocked = (): boolean => (process.env.STAGING_PAYMENT_BLOCK ?? "1") === "1";

export function epsConfigured(): boolean {
  return Boolean(
    process.env.EPS_MERCHANT_ID &&
      process.env.EPS_STORE_ID &&
      process.env.EPS_USERNAME &&
      process.env.EPS_PASSWORD &&
      process.env.EPS_HASH_KEY,
  );
}

/** Absolute app URL for EPS redirect callbacks. */
export function appUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

const epsBase = (): string =>
  (
    process.env.EPS_BASE_URL ||
    (process.env.EPS_SANDBOX === "1" ? "https://sandbox-pgapi.eps.com.bd" : "https://pgapi.eps.com.bd")
  ).replace(/\/+$/, "");

const epsHash = (value: string): string =>
  crypto.createHmac("sha512", Buffer.from(process.env.EPS_HASH_KEY!, "utf8")).update(value, "utf8").digest("base64");

async function getToken(): Promise<string | null> {
  const res = await fetch(`${epsBase()}/v1/Auth/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hash": epsHash(process.env.EPS_USERNAME!) },
    body: JSON.stringify({ userName: process.env.EPS_USERNAME, password: process.env.EPS_PASSWORD }),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { token?: string; data?: { token?: string } };
  return data.data?.token || data.token || null;
}

export type InitiateArgs = {
  orderId: string;
  amountBdt: number;
  customerEmail: string;
  purpose: string;
  customerPhone?: string;
  customerName?: string;
};

export type InitiateResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; blocked?: boolean; reason: string };

export async function initiateEps(args: InitiateArgs): Promise<InitiateResult> {
  if (isPaymentBlocked()) {
    return { ok: false, blocked: true, reason: "Payments are disabled (STAGING_PAYMENT_BLOCK)." };
  }
  if (!epsConfigured()) return { ok: false, reason: "EPS credentials are not configured." };

  const token = await getToken();
  if (!token) return { ok: false, reason: "EPS authentication failed." };

  const amountTaka = Math.round(args.amountBdt);
  const name = args.customerName || args.customerEmail.split("@")[0] || "Admin";
  // Field names/casing match the official EPS SDK EXACTLY (case-sensitive, mixed casing).
  const body = {
    merchantId: process.env.EPS_MERCHANT_ID,
    storeId: process.env.EPS_STORE_ID,
    CustomerOrderId: args.orderId,
    merchantTransactionId: args.orderId,
    transactionTypeId: 1,
    financialEntityId: 0,
    transitionStatusId: 0,
    totalAmount: amountTaka,
    ipAddress: "0.0.0.0",
    version: "1",
    successUrl: appUrl(`/api/eps/return?order=${args.orderId}&status=success`),
    failUrl: appUrl(`/api/eps/return?order=${args.orderId}&status=fail`),
    cancelUrl: appUrl(`/api/eps/return?order=${args.orderId}&status=cancel`),
    customerName: name,
    customerEmail: args.customerEmail,
    CustomerAddress: "N/A",
    CustomerAddress2: "",
    CustomerCity: "Dhaka",
    CustomerState: "Dhaka",
    CustomerPostcode: "1000",
    CustomerCountry: "BD",
    CustomerPhone: args.customerPhone || "01000000000",
    ShipmentName: "",
    ShipmentAddress: "",
    ShipmentAddress2: "",
    ShipmentCity: "",
    ShipmentState: "",
    ShipmentPostcode: "",
    ShipmentCountry: "",
    ValueA: "",
    ValueB: "",
    ValueC: "",
    ValueD: "",
    ShippingMethod: "NO",
    NoOfItem: "1",
    ProductName: args.purpose,
    ProductProfile: "general",
    ProductCategory: "general",
    ProductList: [
      {
        ProductName: args.purpose,
        NoOfItem: "1",
        ProductProfile: "general",
        ProductCategory: "general",
        ProductPrice: String(amountTaka),
      },
    ],
  };

  const res = await fetch(`${epsBase()}/v1/EPSEngine/InitializeEPS`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hash": epsHash(args.orderId), Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => null);

  const bodyText = res ? await res.text().catch(() => "") : "";
  if (!res || !res.ok) {
    return { ok: false, reason: `EPS initialize failed (${res?.status ?? "network"})${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}` };
  }
  let data: { RedirectURL?: string; ErrorMessage?: string } = {};
  try {
    data = JSON.parse(bodyText);
  } catch {
    /* non-JSON */
  }
  if (!data.RedirectURL) return { ok: false, reason: data.ErrorMessage || "EPS returned no redirect URL." };
  return { ok: true, redirectUrl: data.RedirectURL };
}

/** Authoritative verification — never trust the redirect body. Fail-closed. */
export async function verifyEps(
  orderId: string,
): Promise<{ orderId: string; paid: boolean; epsRef?: string } | null> {
  if (isPaymentBlocked() || !epsConfigured() || !orderId) return null;
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(
    `${epsBase()}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${encodeURIComponent(orderId)}`,
    { headers: { "x-hash": epsHash(orderId), Authorization: `Bearer ${token}` } },
  ).catch(() => null);
  if (!res || !res.ok) return { orderId, paid: false };
  const data = (await res.json().catch(() => ({}))) as { Status?: string; EPSTransactionId?: string };
  const paid = String(data.Status || "").toLowerCase() === "success";
  return { orderId, paid, epsRef: data.EPSTransactionId };
}
