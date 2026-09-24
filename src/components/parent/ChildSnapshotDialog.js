import { useCallback, useRef, useState } from "react";
import { apiJson } from "@/lib/api";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const TEXT_FIELDS = [
  {
    key: "favoriteActivities",
    label: "Favorite Activities",
    placeholder: "Art, Reading, Outdoor Play",
  },
  { key: "strengths", label: "Strengths", placeholder: "Kind, Helpful, Creative" },
  {
    key: "areasOfFocus",
    label: "Areas of Focus",
    placeholder: "Following multi-step directions",
  },
  { key: "allergies", label: "Allergies", placeholder: "None" },
  {
    key: "notes",
    label: "Notes",
    field: "snapshotNotes",
    placeholder: "Loves helping with younger children",
  },
];

/**
 * The Edit flow behind the Child Snapshot card. Families keep these lines
 * themselves, so this talks to the snapshot endpoint rather than the full child
 * record, which stays staff-only.
 */
export default function ChildSnapshotDialog({ child, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    favoriteActivities: child.favoriteActivities || "",
    strengths: child.strengths || "",
    areasOfFocus: child.areasOfFocus || "",
    allergies: child.allergies || "",
    snapshotNotes: child.snapshotNotes || "",
  }));
  const [photoUrl, setPhotoUrl] = useState(child.photoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const setField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const uploadPhoto = useCallback(async (file) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("That photo is too large. Please choose one under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          dataBase64,
        }),
      });
      setPhotoUrl(res?.url || "");
    } catch (e) {
      setError(e.message || "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const snapshot = await apiJson(
        `/api/v1/children/${encodeURIComponent(child.id)}/snapshot`,
        {
          method: "PUT",
          body: JSON.stringify({ ...form, photoUrl: photoUrl || null }),
        },
      );
      onSaved?.(snapshot);
    } catch (e) {
      setError(e.message || "Failed to save the snapshot");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${child.firstName}'s snapshot`}
    >
      <form
        onSubmit={save}
        className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-black tracking-tight text-[#12386a] dark:text-gray-100">
              Child Snapshot
            </h2>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              {child.firstName} {child.lastName || ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="h-16 w-16 rounded-[18px] border border-gray-200 object-cover dark:border-gray-600"
              />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-gradient-to-br from-sky-600 to-cyan-500 text-lg font-black text-white">
                {(child.firstName || "C").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-extrabold text-sky-800 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
              >
                {uploading ? "Uploading..." : photoUrl ? "Replace photo" : "Add photo"}
              </button>
              {photoUrl ? (
                <button
                  type="button"
                  onClick={() => setPhotoUrl("")}
                  className="rounded-full border border-gray-200 px-3.5 py-1.5 text-xs font-extrabold text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                uploadPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          {/* Label and control are wired by id rather than nesting: a textarea
              inside its own label folds its value into the label's accessible
              name, which leaves the field unlabelled once it holds text. */}
          {TEXT_FIELDS.map(({ key, label, field, placeholder }) => {
            const name = field || key;
            const inputId = `child-snapshot-${name}`;
            return (
              <div key={name}>
                <label
                  htmlFor={inputId}
                  className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400"
                >
                  {label}
                </label>
                <textarea
                  id={inputId}
                  rows={2}
                  value={form[name]}
                  placeholder={placeholder}
                  onChange={(event) => setField(name, event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100"
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-extrabold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-cyan-600 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save snapshot"}
          </button>
        </div>
      </form>
    </div>
  );
}
