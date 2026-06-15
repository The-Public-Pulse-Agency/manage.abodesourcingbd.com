"use client";

import { useActionState, useState } from "react";
import { createPoAction, type ActionResult } from "@/lib/orders/form-actions";
import { orderChannels } from "@/lib/orders/schema";

type Opt = { id: string; name: string };
type Brand = { id: string; name: string; buyerId: string };

export function NewOrderForm({
  buyers,
  brands,
  factories,
}: {
  buyers: Opt[];
  brands: Brand[];
  factories: Opt[];
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createPoAction, {});
  const [buyerId, setBuyerId] = useState("");
  const brandOpts = brands.filter((b) => b.buyerId === buyerId);

  return (
    <form action={action} className="max-w-3xl space-y-5 rounded-sm border border-line bg-surface p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="PO number" required>
          <input name="poNumber" required className="input w-full" placeholder="e.g. 209531" />
        </Field>
        <Field label="Channel">
          <select name="channel" defaultValue="DIRECT" className="select w-full">
            {orderChannels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Buyer" required>
          <select
            name="buyerId"
            required
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="select w-full"
          >
            <option value="">Select buyer…</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Brand" required>
          <select name="brandId" required disabled={!buyerId} className="select w-full">
            <option value="">{buyerId ? "Select brand…" : "Pick a buyer first"}</option>
            {brandOpts.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Factory" required>
          <select name="factoryId" required className="select w-full">
            <option value="">Select factory…</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select name="currency" defaultValue="USD" className="select w-full">
            <option value="USD">USD</option>
            <option value="BDT">BDT</option>
          </select>
        </Field>
        <Field label="Order date">
          <input name="orderDate" type="date" className="input w-full" />
        </Field>
        <Field label="CRD (customer requested)">
          <input name="crd" type="date" className="input w-full" />
        </Field>
        <Field label="Ex-factory date">
          <input name="exFactoryDate" type="date" className="input w-full" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={2} className="input w-full" placeholder="Optional" />
      </Field>

      {state.error && (
        <p className="rounded-sm bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create draft order"}
        </button>
        <span className="text-xs text-ink-soft">
          Lines &amp; quantities are added on the next screen.
        </span>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}
