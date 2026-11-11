import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import GeneralSettings from "@/components/global/GeneralSettings";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import { DISCOUNT_APPLIES_TO, PRICED_ADD_ONS, validatePricing } from "@/lib/subscriptionPricing";

// Global admin > Settings > Subscription Pricing (client mockup 2026-11-10).
// Each pricing set has an effective date; the set in effect is the latest
// one on or before today. Subscribers' prices are worked out from it
// (src/lib/subscriptionPricing.js).

const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const cell = "w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-lg border border-blue-700 px-3 py-1.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";
const h2 = "mb-2 text-base font-extrabold text-[#16305e] dark:text-blue-100";

// Prices shown with two decimals ("24.90"); the inputs edit them as text.
const two = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? v : Number(v).toFixed(2));
function withCents(data) {
  return {
    ...data,
    baseRanges: data.baseRanges.map((r) => ({ ...r, price: two(r.price) })),
    addOns: Object.fromEntries(Object.entries(data.addOns).map(([k, v]) => [k, two(v)])),
    curriculumCenters: data.curriculumCenters.map((r) => ({ ...r, standard: two(r.standard), faithBased: two(r.faithBased) })),
    homeDaycare: data.homeDaycare.map((r) => ({ ...r, standard: two(r.standard), faithBased: two(r.faithBased) })),
  };
}

function Money({ value, onChange, label }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
      <input type="number" min="0" step="0.01" aria-label={label} className={`${cell} pl-5 text-right`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PriceRows({ rows, onChange, nameLabel, addLabel }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-gray-600 dark:text-gray-300">
            <th className="pb-1">{nameLabel}</th>
            <th className="w-28 pb-1 text-center">Standard</th>
            <th className="w-28 pb-1 text-center">Faith Based</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key || i}>
              <td className="py-0.5 pr-2">
                <input className={cell} aria-label={`${nameLabel} name`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
              </td>
              <td className="px-1 py-0.5">
                <Money label={`${r.label} Standard price`} value={r.standard} onChange={(v) => set(i, { standard: v })} />
              </td>
              <td className="px-1 py-0.5">
                <Money label={`${r.label} Faith Based price`} value={r.faithBased} onChange={(v) => set(i, { faithBased: v })} />
              </td>
              <td className="text-center">
                <button type="button" aria-label={`Remove ${r.label}`} className="text-red-600" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className={`${button} mt-2`} onClick={() => onChange([...rows, { key: "", label: "", standard: 0, faithBased: 0 }])}>
        + {addLabel}
      </button>
    </>
  );
}

function PricingEditor({ value, onChange }) {
  const [selected, setSelected] = useState(new Set());
  const set = (patch) => onChange({ ...value, ...patch });
  const ranges = value.baseRanges;
  const setRange = (i, patch) => set({ baseRanges: ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setDiscount = (i, patch) => set({ discounts: value.discounts.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <section className={card}>
          <h2 className={h2}>Base Program – Price Per Child</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-bold text-gray-600 dark:text-gray-300">
                <th className="w-8" />
                <th className="pb-1">From (Children)</th>
                <th className="pb-1">To (Children)</th>
                <th className="pb-1">Price Per Child</th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select range ${r.from}–${r.to}`}
                      checked={selected.has(i)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="py-0.5 pr-2">
                    <input type="number" min="1" aria-label="From (Children)" className={`${cell} text-center`} value={r.from} onChange={(e) => setRange(i, { from: e.target.value })} />
                  </td>
                  <td className="py-0.5 pr-2">
                    <input type="number" min="1" aria-label="To (Children)" className={`${cell} text-center`} value={r.to} onChange={(e) => setRange(i, { to: e.target.value })} />
                  </td>
                  <td className="py-0.5">
                    <Money label={`Price per child ${r.from}–${r.to}`} value={r.price} onChange={(v) => setRange(i, { price: v })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between gap-2">
            <button
              type="button"
              className={button}
              onClick={() => {
                const last = ranges[ranges.length - 1];
                const from = last ? Number(last.to) + 1 : 1;
                set({ baseRanges: [...ranges, { from, to: from + 99, price: last?.price ?? 0 }] });
              }}
            >
              + Add Range
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
              disabled={!selected.size}
              onClick={() => {
                set({ baseRanges: ranges.filter((_, i) => !selected.has(i)) });
                setSelected(new Set());
              }}
            >
              Delete Selected
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            A subscriber pays the range&apos;s To number × its price per child (15 children in 11–20 pays for 20).
          </p>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className={h2}>Discounts</h2>
            <button
              type="button"
              className={button}
              onClick={() => set({ discounts: [...value.discounts, { id: "", name: "", type: "PERCENT", amount: 0, appliesTo: "ALL", active: true }] })}
            >
              + Add Discount
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-600 dark:text-gray-300">
                <th className="pb-1">Discount Name</th>
                <th className="pb-1">Type</th>
                <th className="w-24 pb-1">Amount</th>
                <th className="pb-1">Applies To</th>
                <th className="pb-1">Status</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {value.discounts.map((d, i) => (
                <tr key={d.id || i}>
                  <td className="py-0.5 pr-2">
                    <input className={cell} aria-label="Discount name" value={d.name} onChange={(e) => setDiscount(i, { name: e.target.value })} />
                  </td>
                  <td className="pr-2 text-xs text-gray-600 dark:text-gray-300">Percentage</td>
                  <td className="py-0.5 pr-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        aria-label={`${d.name} percentage`}
                        className={`${cell} pr-6 text-right`}
                        value={d.amount}
                        onChange={(e) => setDiscount(i, { amount: e.target.value })}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="py-0.5 pr-2">
                    <select className={cell} aria-label={`${d.name} applies to`} value={d.appliesTo} onChange={(e) => setDiscount(i, { appliesTo: e.target.value })}>
                      {DISCOUNT_APPLIES_TO.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-0.5 pr-2">
                    <select
                      className={`${cell} ${d.active ? "bg-green-100 text-green-800" : ""}`}
                      aria-label={`${d.name} status`}
                      value={d.active ? "ACTIVE" : "INACTIVE"}
                      onChange={(e) => setDiscount(i, { active: e.target.value === "ACTIVE" })}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" aria-label={`Remove ${d.name}`} className="text-red-600" onClick={() => set({ discounts: value.discounts.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="space-y-4">
        <section className={card}>
          <h2 className={h2}>Add-On Programs – Price Per Child</h2>
          <div className="space-y-1">
            {PRICED_ADD_ONS.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-800 dark:text-gray-200">{a.label}</span>
                <div className="w-32">
                  <Money label={`${a.label} price per child`} value={value.addOns[a.key]} onChange={(v) => set({ addOns: { ...value.addOns, [a.key]: v } })} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={card}>
          <h2 className={h2}>Curriculum – Centers – Price Per Classroom</h2>
          <PriceRows rows={value.curriculumCenters} onChange={(curriculumCenters) => set({ curriculumCenters })} nameLabel="Age Group" addLabel="Add Age Group" />
        </section>
        <section className={card}>
          <h2 className={h2}>Curriculum – Home Daycare – Price Per Program</h2>
          <PriceRows rows={value.homeDaycare} onChange={(homeDaycare) => set({ homeDaycare })} nameLabel="Program Type" addLabel="Add Program" />
        </section>
      </div>
    </div>
  );
}

function NewSetDialog({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New Pricing Set">
      <form
        className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await onCreate({ name, effectiveDate });
          } catch (err) {
            setError(err.message || "Could not create the pricing set");
            setSaving(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">New Pricing Set</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">It starts as a copy of the prices in effect today. It takes over on its effective date.</p>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Name</span>
          <input className={cell} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. January 2027" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Effective Date</span>
          <input type="date" className={cell} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </label>
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PricingSettings() {
  const [sets, setSets] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null); // { name, effectiveDate, data }
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);

  const pick = useCallback((list, id) => {
    const set = list.find((s) => s.id === id) || list.find((s) => s.current) || list[0];
    setSelectedId(set?.id || "");
    setDraft(set ? { name: set.name, effectiveDate: set.effectiveDate, data: withCents(set.data) } : null);
    setDirty(false);
  }, []);

  useEffect(() => {
    apiJson("/api/v1/global/pricing-sets")
      .then(({ sets: list }) => {
        setSets(list);
        pick(list, "");
      })
      .catch((e) => setError(e.message || "Could not load the pricing"));
  }, [pick]);

  const selected = useMemo(() => (sets || []).find((s) => s.id === selectedId), [sets, selectedId]);
  const edit = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
    setNotice("");
  };

  async function save() {
    const checked = validatePricing(draft.data);
    if (checked.error) {
      setError(checked.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { sets: list } = await apiJson(`/api/v1/global/pricing-sets/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ name: draft.name, effectiveDate: draft.effectiveDate, data: checked.data }),
      });
      setSets(list);
      pick(list, selectedId);
      setNotice("Pricing saved.");
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" className={primary} onClick={save} disabled={!draft || !dirty || saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
      {error ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}
      {!sets ? (
        <div className={card}>Loading...</div>
      ) : (
        <>
          <div className={`${card} mb-4 flex flex-wrap items-end justify-between gap-3`}>
            <h2 className="text-xl font-extrabold text-[#16305e] dark:text-blue-100">Subscription Pricing</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Pricing Set</span>
                <select
                  className={cell}
                  value={selectedId}
                  onChange={(e) => {
                    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
                    pick(sets, e.target.value);
                  }}
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.current ? " (Current)" : s.effectiveDate > new Date().toISOString().slice(0, 10) ? " (Upcoming)" : " (Past)"}
                    </option>
                  ))}
                </select>
              </label>
              {draft ? (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Name</span>
                    <input className={cell} value={draft.name} onChange={(e) => edit({ name: e.target.value })} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Effective Date</span>
                    <input type="date" className={cell} value={draft.effectiveDate} onChange={(e) => edit({ effectiveDate: e.target.value })} />
                  </label>
                </>
              ) : null}
              <button type="button" className={button} onClick={() => setAdding(true)}>
                + New Pricing Set
              </button>
            </div>
          </div>
          {selected && !selected.current ? (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {selected.effectiveDate > new Date().toISOString().slice(0, 10)
                ? `These prices take over on ${selected.effectiveDate}. Subscribers are priced with the current set until then.`
                : "This set is no longer in effect; a newer set has replaced it."}
            </p>
          ) : null}
          {draft ? <PricingEditor value={draft.data} onChange={(data) => edit({ data })} /> : <div className={card}>No pricing set yet.</div>}
        </>
      )}
      {adding ? (
        <NewSetDialog
          onClose={() => setAdding(false)}
          onCreate={async (body) => {
            const out = await apiJson("/api/v1/global/pricing-sets", { method: "POST", body: JSON.stringify(body) });
            setSets(out.sets);
            pick(out.sets, out.id);
            setAdding(false);
            setNotice("New pricing set created from the current prices. Change the prices and click Save Changes.");
          }}
        />
      ) : null}
    </>
  );
}

const TABS = [
  { key: "general", label: "General" },
  { key: "pricing", label: "Subscription Pricing" },
];

export default function GlobalSettingsPage() {
  const router = useRouter();
  const tab = router.query.tab === "pricing" ? "pricing" : "general";
  return (
    <GlobalLayout title="Settings">
      <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-gray-100">Settings</h1>
      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => router.replace({ pathname: router.pathname, query: t.key === "general" ? {} : { tab: t.key } }, undefined, { shallow: true })}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold ${tab === t.key ? "bg-[#16305e] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "general" ? <GeneralSettings /> : <PricingSettings />}
    </GlobalLayout>
  );
}
