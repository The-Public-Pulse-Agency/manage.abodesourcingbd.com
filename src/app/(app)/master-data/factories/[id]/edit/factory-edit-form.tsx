"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { factoryTypes } from "@/lib/masterdata/factory";
import { updateFactoryFromForm } from "@/lib/masterdata/factory-form-actions";

export function FactoryEditForm({
  factory,
}: {
  factory: { id: string; name: string; type: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null; address: string | null };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  return (
    <form
      action={async (fd) => {
        const res = await updateFactoryFromForm(factory.id, fd);
        if (res.ok) {
          router.push("/master-data/factories");
        } else {
          setIsError(true);
          setMessage(res.error);
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Factory name</span>
        <input
          name="name"
          aria-label="Factory name"
          placeholder="Factory name"
          required
          defaultValue={factory.name}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Factory type</span>
        <select
          name="type"
          aria-label="Factory type"
          defaultValue={factory.type}
          className="select"
        >
          {factoryTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Contact</span>
        <input
          name="contactName"
          aria-label="Contact"
          placeholder="Contact (optional)"
          defaultValue={factory.contactName ?? ""}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Contact email</span>
        <input name="contactEmail" type="email" aria-label="Contact email" placeholder="Email" defaultValue={factory.contactEmail ?? ""} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Contact phone</span>
        <input name="contactPhone" aria-label="Contact phone" placeholder="Phone" defaultValue={factory.contactPhone ?? ""} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Address</span>
        <input name="address" aria-label="Address" placeholder="Address" defaultValue={factory.address ?? ""} className="input min-w-[16rem]" />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Save changes
      </button>
      <Link
        href="/master-data/factories"
        className="text-sm text-ink-soft hover:underline"
      >
        Cancel
      </Link>
      {message && (
        <span className={`text-sm ${isError ? "text-bad" : "text-ink-soft"}`}>{message}</span>
      )}
    </form>
  );
}
