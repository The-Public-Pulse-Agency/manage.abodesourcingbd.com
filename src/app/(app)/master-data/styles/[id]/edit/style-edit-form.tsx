"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateStyleFromForm } from "@/lib/masterdata/style-form-actions";

type BrandOption = { id: string; name: string; code: string };

type StyleValues = {
  id: string;
  brandId: string;
  styleCode: string;
  name: string;
  category: string | null;
  composition: string | null;
  description: string | null;
};

export function StyleEditForm({
  style,
  brands,
}: {
  style: StyleValues;
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await updateStyleFromForm(style.id, fd);
        if (res.ok) {
          router.push("/master-data/styles");
        } else {
          setError(res.error);
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 elevate"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Brand</span>
        <select
          name="brandId"
          aria-label="Brand"
          required
          className="select"
          defaultValue={style.brandId}
        >
          <option value="" disabled>
            Select brand…
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.code})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Style code</span>
        <input
          name="styleCode"
          placeholder="Style code"
          aria-label="Style code"
          required
          className="input"
          defaultValue={style.styleCode}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Style name</span>
        <input
          name="name"
          placeholder="Style name"
          aria-label="Style name"
          required
          className="input"
          defaultValue={style.name}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Category</span>
        <input
          name="category"
          placeholder="Category (optional)"
          aria-label="Category"
          className="input"
          defaultValue={style.category ?? ""}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Composition</span>
        <input
          name="composition"
          placeholder="Composition (optional)"
          aria-label="Composition"
          className="input"
          defaultValue={style.composition ?? ""}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Description</span>
        <input
          name="description"
          placeholder="Description (optional)"
          aria-label="Description"
          className="input"
          defaultValue={style.description ?? ""}
        />
      </label>
      <button
        type="submit"
        className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Save changes
      </button>
      <Link href="/master-data/styles" className="text-sm text-ink-soft hover:underline">
        Cancel
      </Link>
      {error && <span className="text-sm text-bad">{error}</span>}
    </form>
  );
}
