"use server";

import { redirect } from "next/navigation";
import { signUp } from "./signup";

export async function signUpAction(fd: FormData): Promise<{ error: string } | void> {
  try {
    await signUp({
      companyName: String(fd.get("companyName") ?? ""),
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sign-up failed" };
  }
  redirect("/login?welcome=1");
}
