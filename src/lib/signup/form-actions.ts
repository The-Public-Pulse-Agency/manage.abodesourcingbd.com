"use server";

import { headers } from "next/headers";
import { signUp } from "./signup";

export async function signUpAction(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  try {
    await signUp(
      {
        companyName: String(fd.get("companyName") ?? ""),
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
      },
      { ip, honeypot: String(fd.get("website") ?? "") },
    );
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sign-up failed" };
  }
}
