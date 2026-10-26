import { Modal, NAVY, control, fileToBase64 } from "@/components/training/trainingUi";
import { apiJson } from "@/lib/api";
import { TRAINING_SOURCES } from "@/lib/training";
import { useMemo, useState } from "react";

// Record Training pop-up (client mockups 05 and 08). Staff record their own
// training; with `staff` (coach Staff Training) it records it for the
// attendees, either all current staff or the ones ticked.

const label = "block text-sm font-bold text-[#0b2a5b] dark:text-blue-100";
const req = <span className="text-red-500"> *</span>;
const today = () => new Date().toISOString().slice(0, 10);

export default function RecordTrainingDialog({ centerId, staff, onClose, onSaved }) {
  const [form, setForm] = useState({ topic: "", hours: "", nonInteractiveHours: "", interactiveHours: "", date: today(), performedBy: "", source: TRAINING_SOURCES[0], description: "" });
  const [attachment, setAttachment] = useState(null); // { url, name }
  const [allStaff, setAllStaff] = useState(false);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const visibleStaff = useMemo(
    () => (staff || []).filter((s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase())),
    [staff, search],
  );

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: await fileToBase64(file) }),
      });
      setAttachment({ url: saved.url, name: file.name });
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const hours = Number(form.hours);
    const nonInteractive = Number(form.nonInteractiveHours);
    const interactive = Number(form.interactiveHours);
    if (!form.topic.trim()) return setError("Enter the training topic");
    if ([form.hours, form.nonInteractiveHours, form.interactiveHours].some((v) => v === "") || !(hours > 0) || nonInteractive < 0 || interactive < 0) {
      return setError("Enter the hours, non-interactive hours and interactive hours");
    }
    if (Math.abs(nonInteractive + interactive - hours) > 0.01) return setError("Non-interactive and interactive hours should add up to the hours");
    if (!form.date) return setError("Choose the date");
    if (!form.performedBy.trim()) return setError("Enter the trainer or facilitator");
    const userIds = staff ? (allStaff ? staff.map((s) => s.id) : picked) : undefined;
    if (staff && !userIds.length) return setError("Choose the staff members who attended");

    setBusy(true);
    setError("");
    try {
      await apiJson("/api/v1/training-logs", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          topic: form.topic.trim(),
          hours,
          nonInteractiveHours: nonInteractive,
          interactiveHours: interactive,
          date: form.date,
          performedBy: form.performedBy.trim(),
          source: form.source,
          description: form.description.trim() || null,
          certificateUrl: attachment?.url || null,
          certificateFileName: attachment?.name || null,
          ...(userIds ? { userIds } : {}),
        }),
      });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the training");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record Training"
      onClose={onClose}
      footer={
        <>
          <label className="mr-auto flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-left">
            <span aria-hidden>📎</span>
            <span>
              <span className="block text-xs font-bold text-blue-800 dark:text-blue-200">{attachment ? attachment.name : busy ? "Uploading..." : "Add Attachment"}</span>
              <span className="block text-[11px] text-gray-500">PDF, DOC, PPT, etc.</span>
            </span>
            <input type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
          </label>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            Save Training
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className={label}>
          Topic{req}
          <input value={form.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="Enter training topic..." className={control} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Hours{req}
            <input type="number" min="0" step="0.25" value={form.hours} onChange={(e) => set({ hours: e.target.value })} placeholder="e.g. 1.5" className={control} />
          </label>
          <label className={label}>
            Non-Interactive Hours{req}
            <input type="number" min="0" step="0.25" value={form.nonInteractiveHours} onChange={(e) => set({ nonInteractiveHours: e.target.value })} placeholder="e.g. 1.0" className={control} />
          </label>
          <label className={label}>
            Interactive Hours{req}
            <input type="number" min="0" step="0.25" value={form.interactiveHours} onChange={(e) => set({ interactiveHours: e.target.value })} placeholder="e.g. 0.5" className={control} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Date{req}
            <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={control} />
          </label>
          <label className={label}>
            Trainer / Facilitator{req}
            <input value={form.performedBy} onChange={(e) => set({ performedBy: e.target.value })} placeholder="Enter trainer or facilitator name..." className={control} />
          </label>
          <label className={label}>
            Source of Training
            <select value={form.source} onChange={(e) => set({ source: e.target.value })} className={control}>
              {TRAINING_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className={label}>
          Description / Notes
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value.slice(0, 1000) })} placeholder="Enter a description of the training, key points covered, resources, etc..." className={control} />
          <span className="block text-right text-xs font-normal text-gray-500">{form.description.length}/1000</span>
        </label>

        {staff ? (
          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
            <div className={`text-sm font-bold ${NAVY}`}>Attendees{req}</div>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                {[[true, "All Staff", "Select all current staff members"], [false, "Select Staff Members", "Choose specific staff members who attended"]].map(([value, title, hint]) => (
                  <label key={title} className="flex items-start gap-2 text-sm">
                    <input type="radio" name="attendees" checked={allStaff === value} onChange={() => setAllStaff(value)} className="mt-1" />
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-xs text-gray-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!allStaff ? (
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." aria-label="Search staff" className={`${control} sm:w-64`} />
              ) : null}
            </div>
            {!allStaff ? (
              <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-2 dark:border-gray-700">
                {visibleStaff.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(s.id)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((id) => id !== s.id)))}
                    />
                    {s.name}
                  </label>
                ))}
                {!visibleStaff.length ? <p className="text-sm text-gray-500">No staff found.</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
