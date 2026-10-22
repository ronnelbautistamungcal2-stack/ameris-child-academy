import { apiJson } from "@/lib/api";
import { useState } from "react";

export default function AdditionalSupplyRequest({ centerId, classRoomId }) {
  const emptyForm = { item: "", quantity: 1, purpose: "", notes: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!form.item.trim() || !centerId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/supply-requests", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          classRoomId: classRoomId || null,
          item: form.item.trim(),
          quantity: Number(form.quantity) || 1,
          purpose: form.purpose || null,
          notes: form.notes || null,
        }),
      });
      setSuccess("Supply request sent to admin.");
      setForm(emptyForm);
      setTimeout(() => setSuccess(""), 4000);
    } catch (e2) {
      setError(e2.message || "Failed to send supply request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-extrabold text-gray-900">Request Additional Supplies</h3>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-sky-100 px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-gray-500">
            Need something that isn't part of a lesson? Request it here and it will go straight to the admin's supply request list.
          </p>
          {error ? (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
          ) : null}
          {success ? (
            <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{success}</div>
          ) : null}
          <form onSubmit={submit} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                placeholder="Item (e.g. Paper towels)"
                value={form.item}
                onChange={(e) => setForm((p) => ({ ...p, item: e.target.value }))}
                required
              />
              <input
                type="number"
                min="1"
                className="w-16 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm focus:border-sky-400 focus:outline-none"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              placeholder="Purpose (optional)"
              value={form.purpose}
              onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
            />
            <textarea
              rows={2}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button
              type="submit"
              disabled={saving || !form.item.trim()}
              className="self-start rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Sending…" : "Send Request"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
