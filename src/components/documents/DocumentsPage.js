import DocumentLibrary from "@/components/parent/DocumentLibrary";
import { Modal } from "@/components/training/trainingUi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { apiJson } from "@/lib/api";
import { DOCUMENT_ROLES, STAFF_DOCUMENT_ROLES, documentRoleLabel } from "@/lib/policyDocuments";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

// Policies & Procedures and Additional Resources for every role (client
// mockups 38 and 39): the documents shared with the viewer's role on the
// left, the selected one on the right. Admins add, edit and delete, and pick
// which roles see each document.

const NAVY = "text-[#12386a] dark:text-slate-100";
const control = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const label = "block text-sm font-bold text-[#12386a] dark:text-slate-100";

const COPY = {
  POLICY: {
    title: "Policies and Procedures",
    subtitle: "View, print, or download center policies and procedures.",
    listTitle: "Available Documents",
    search: "Search policies...",
    empty: "No policies have been shared with you yet.",
    add: "+ Add Policy",
    icon: "pdf",
  },
  RESOURCE: {
    title: "Additional Resources",
    subtitle: "View, print, or download helpful resources for parents, staff, and students.",
    listTitle: "Available Resources",
    search: "Search resources...",
    empty: "No resources have been shared with you yet.",
    add: "+ Add Resource",
    icon: "tinted",
  },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage({ category }) {
  const { data: session } = useSession();
  const canManage = session?.user?.role === "ADMIN";
  const copy = COPY[category];
  const [docs, setDocs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // {} new, or a document to edit
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await apiJson(`/api/v1/policies?category=${category}`);
      // Oldest first, so the list follows the order the center added documents in.
      setDocs(
        (Array.isArray(rows) ? rows : []).sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.title).localeCompare(String(b.title)),
        ),
      );
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    apiJson("/api/v1/centers")
      .then((rows) => setCenters(Array.isArray(rows) ? rows : []))
      .catch(() => setCenters([]));
  }, [canManage]);

  async function confirmDelete() {
    const doc = deleting;
    setDeleting(null);
    try {
      await apiJson(`/api/v1/policies/${doc.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  const actionButton = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${NAVY}`}>{copy.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{copy.subtitle}</p>
        </div>
        {canManage ? (
          <button type="button" onClick={() => setDialog({})} className="rounded-lg bg-[#1a56db] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1747b8]">
            {copy.add}
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      <DocumentLibrary
        docs={docs}
        loading={loading}
        listTitle={copy.listTitle}
        searchPlaceholder={copy.search}
        emptyText={canManage ? `Nothing here yet. Use ${copy.add.replace("+ ", "")} to share one.` : copy.empty}
        iconVariant={copy.icon}
        actions={
          canManage
            ? (doc) => (
                <>
                  <span className="self-center text-[11px] text-gray-500 dark:text-gray-400">
                    {(doc.roles || []).map(documentRoleLabel).join(", ")}
                  </span>
                  <button type="button" onClick={() => setDialog(doc)} className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200`}>
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleting(doc)} className={`${actionButton} border-red-200 text-red-600 hover:bg-red-50`}>
                    Delete
                  </button>
                </>
              )
            : undefined
        }
      />

      {dialog ? (
        <DocumentDialog
          category={category}
          doc={dialog.id ? dialog : null}
          centers={centers}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await load();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={category === "POLICY" ? "Delete policy?" : "Delete resource?"}
        message={`"${deleting?.title}" will be removed for everyone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function DocumentDialog({ category, doc, centers, onClose, onSaved }) {
  const isResource = category === "RESOURCE";
  const isWebsiteOnly = Boolean(doc?.websiteUrl) && doc?.url === doc?.websiteUrl;
  const [form, setForm] = useState(() => ({
    title: doc?.title || "",
    description: doc?.description || "",
    url: doc && !isWebsiteOnly ? doc.url : "",
    fileName: doc && !isWebsiteOnly ? decodeURIComponent(String(doc.url).split("/").pop() || "") : "",
    websiteUrl: doc?.websiteUrl || "",
    contactEmail: doc?.contactEmail || "",
    contactPhone: doc?.contactPhone || "",
    logoUrl: doc?.logoUrl || "",
    version: doc?.version || "",
    centerId: doc?.centerId || "",
    roles: (doc?.roles || (isResource ? [] : ["TEACHER"])).filter((r) => DOCUMENT_ROLES.includes(r)),
    showOnHomePage: Boolean(doc?.showOnHomePage),
    active: doc ? doc.active !== false : true,
  }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const allStaff = STAFF_DOCUMENT_ROLES.every((r) => form.roles.includes(r));

  async function upload(file) {
    if (!file) return;
    if (!isResource && !/\.pdf$/i.test(file.name)) return setError("Policies must be a PDF.");
    if (file.size > 25 * 1024 * 1024) return setError("That file is too large (25MB max).");
    setUploading(true);
    setError("");
    try {
      const saved = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: await fileToBase64(file) }),
      });
      set({ url: saved.url, fileName: file.name });
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function toggleRole(role) {
    set({ roles: form.roles.includes(role) ? form.roles.filter((r) => r !== role) : [...form.roles, role] });
  }

  async function save() {
    setSaving(true);
    setError("");
    const body = { ...form, category, url: form.url || form.websiteUrl };
    delete body.fileName;
    try {
      if (doc) await apiJson(`/api/v1/policies/${doc.id}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiJson("/api/v1/policies", { method: "POST", body: JSON.stringify(body) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save");
      setSaving(false);
    }
  }

  const noun = isResource ? "Resource" : "Policy";
  return (
    <Modal
      title={doc ? `Edit ${noun}` : isResource ? "Add Resource" : "New Policy"}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving || uploading} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : doc ? "Save Changes" : isResource ? "Add Resource" : "Publish Policy"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div>
          <div className={label}>{isResource ? "File (optional)" : "PDF Document *"}</div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files?.[0]);
            }}
            className="mt-1 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 px-4 py-6 text-sm dark:border-sky-800 dark:bg-gray-800"
          >
            <span className="font-semibold text-blue-700 dark:text-sky-300">
              {uploading ? "Uploading..." : form.fileName ? `${form.fileName} (click to replace)` : "Click to upload or drag and drop"}
            </span>
            <span className="text-xs text-gray-500">{isResource ? "PDF, image or document" : "PDF only"}, max 25 MB</span>
          </button>
          <input ref={fileRef} type="file" accept={isResource ? undefined : "application/pdf"} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          {isResource && form.url ? (
            <button type="button" onClick={() => set({ url: "", fileName: "" })} className="mt-1 text-xs font-semibold text-red-600">Remove file</button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            {isResource ? "Name *" : "Title *"}
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={isResource ? "Enter resource name..." : "Policy title"} className={control} />
          </label>
          {isResource ? (
            <label className={label}>
              Website URL
              <input value={form.websiteUrl} onChange={(e) => set({ websiteUrl: e.target.value })} placeholder="https://..." className={control} />
            </label>
          ) : (
            <label className={label}>
              Description
              <input value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Brief description (optional)" className={control} />
            </label>
          )}
          {isResource ? (
            <>
              <label className={label}>
                Contact Email
                <input value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="Enter contact email..." className={control} />
              </label>
              <label className={label}>
                Contact Phone
                <input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="(000) 000-0000" className={control} />
              </label>
              <label className={label}>
                Logo URL
                <input value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://..." className={control} />
              </label>
            </>
          ) : (
            <label className={label}>
              Center
              <select value={form.centerId} onChange={(e) => set({ centerId: e.target.value })} className={control}>
                <option value="">All Centers</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label className={label}>
            Version
            <input value={form.version} onChange={(e) => set({ version: e.target.value })} placeholder="e.g. 2026-2027" className={control} />
          </label>
        </div>

        {isResource ? (
          <label className={label}>
            Description
            <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Enter a description..." className={control} />
          </label>
        ) : null}

        <div className={`grid gap-3 ${isResource ? "sm:grid-cols-[2fr_1fr]" : ""}`}>
          <fieldset className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <legend className={`px-1 ${label}`}>{isResource ? "Apply to Roles" : "Visible to Roles *"}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allStaff}
                  onChange={() =>
                    set({ roles: allStaff ? form.roles.filter((r) => !STAFF_DOCUMENT_ROLES.includes(r)) : [...new Set([...form.roles, ...STAFF_DOCUMENT_ROLES])] })
                  }
                />
                All Staff
              </label>
              {DOCUMENT_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
                  {documentRoleLabel(role)}
                </label>
              ))}
            </div>
          </fieldset>
          {isResource ? (
            <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <label className={label}>
                Add to Home Page
                <select value={form.showOnHomePage ? "yes" : "no"} onChange={(e) => set({ showOnHomePage: e.target.value === "yes" })} className={control}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              <p className="mt-1 text-xs text-gray-500">Select if this resource should be listed on the website&apos;s Resources page.</p>
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
          Active
        </label>
      </div>
    </Modal>
  );
}
