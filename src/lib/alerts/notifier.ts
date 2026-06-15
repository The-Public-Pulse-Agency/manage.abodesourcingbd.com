// Pluggable email channel. v1 ships an in-app DB feed plus a best-effort email digest;
// WhatsApp/SMS can slot in behind the same interface later.

export interface Notifier {
  email(to: string, subject: string, body: string): Promise<void>;
}

/** Default channel: log only (dev/test, or when no email provider is configured). */
export const logNotifier: Notifier = {
  async email(to, subject) {
    console.info(`[alerts] (log) email → ${to}: ${subject}`);
  },
};

/** Resend over plain HTTP (no SDK dependency). Throws on non-2xx so callers can isolate. */
function resendNotifier(apiKey: string, from: string): Notifier {
  return {
    async email(to, subject, body) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, text: body }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    },
  };
}

export function getNotifier(): Notifier {
  const key = process.env.RESEND_API_KEY;
  if (!key) return logNotifier;
  const from = process.env.ALERT_EMAIL_FROM ?? "alerts@abodesourcingbd.com";
  return resendNotifier(key, from);
}
