import { useCallback, useEffect, useState } from "react";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";

// Global admin > Terms & Agreements (client 2026-11-11). Publish a new
// version of the End-User Terms of Use (and later the website Terms of
// Service and Home Daycare Subscriber Agreement) and see who accepted which
// version, when and from where.

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-xl border border-blue-700 px-3 py-1.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";

const when = (v) => new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function PublishDialog({ kind, onClose, onPublished }) {
  const latest = kind.versions[0];
  const [form, setForm] = useState({ version: todayKey(), title: latest?.title || kind.label, body: latest?.body || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Publish New Version">
      <form
        className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-3 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await apiJson("/api/v1/global/terms", { method: "POST", body: JSON.stringify({ kind: kind.value, ...form }) });
            onPublished();
          } catch (err) {
            setError(err.message || "Could not publish");
            setSaving(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Publish New Version – {kind.label}</h2>
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {kind.atLogin
            ? "It's in force as soon as you publish: every staff member and parent will be asked to accept it at their next sign-in."
            : "It's in force as soon as you publish."}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Version</span>
            <input className={input} value={form.version} onChange={(e) => set({ version: e.target.value })} required />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Title</span>
            <input className={input} value={form.title} onChange={(e) => set({ title: e.target.value })} required />
          </label>
        </div>
        <label className="flex min-h-0 flex-1 flex-col text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Text</span>
          <textarea className={`${input} min-h-[300px] flex-1 font-mono text-xs`} value={form.body} onChange={(e) => set({ body: e.target.value })} required />
        </label>
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Publishing..." : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Acceptances({ doc, onClose }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      apiJson(`/api/v1/global/terms/${doc.id}?q=${encodeURIComponent(q)}`)
        .then(setData)
        .catch((e) => setError(e.message || "Could not load"));
    }, 250);
    return () => clearTimeout(t);
  }, [doc.id, q]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Who Accepted">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Who Accepted</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {doc.title}, version {doc.version} ({doc.acceptances.toLocaleString()} acceptances)
            </p>
          </div>
          <button type="button" className={button} onClick={onClose}>
            Close
          </button>
        </div>
        <input className={`${input} mb-3`} placeholder="Search name or email..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search name or email" />
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-blue-50 text-xs font-bold text-[#16305e] dark:bg-gray-800 dark:text-blue-100">
              <tr>
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5">Email</th>
                <th className="px-2 py-1.5">Account</th>
                <th className="px-2 py-1.5">Role</th>
                <th className="px-2 py-1.5">Accepted</th>
                <th className="px-2 py-1.5">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {(data?.acceptances || []).map((a) => (
                <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800" title={a.userAgent || ""}>
                  <td className="px-2 py-1">{a.name}</td>
                  <td className="px-2 py-1">{a.email}</td>
                  <td className="px-2 py-1">{a.account ? `${a.account.accountNumber} ${a.account.name}` : "—"}</td>
                  <td className="px-2 py-1">{a.role || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1">{when(a.acceptedAt)}</td>
                  <td className="px-2 py-1 font-mono text-xs">{a.ipAddress || "—"}</td>
                </tr>
              ))}
              {data && !data.acceptances.length ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-gray-500">
                    No one yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function GlobalTermsPage() {
  const [kinds, setKinds] = useState(null);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [reading, setReading] = useState(null);

  const load = useCallback(() => {
    apiJson("/api/v1/global/terms")
      .then((d) => setKinds(d.kinds))
      .catch((e) => setError(e.message || "Could not load the terms"));
  }, []);
  useEffect(load, [load]);

  return (
    <GlobalLayout title="Terms & Agreements">
      <h1 className="mb-1 text-3xl font-extrabold text-gray-900 dark:text-gray-100">Terms &amp; Agreements</h1>
      <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
        Terms people accept with an &ldquo;I agree&rdquo; box. Each acceptance records the person, the version, the date and time, and their IP address.
      </p>
      {error ? <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {!kinds ? (
        <div className={card}>Loading...</div>
      ) : (
        <div className="space-y-4">
          {kinds.map((k) => (
            <div key={k.value} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{k.label}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{k.help}</p>
                </div>
                <button type="button" className={primary} onClick={() => setPublishing(k)}>
                  {k.versions.length ? "Publish New Version" : "Publish"}
                </button>
              </div>
              {k.versions.length ? (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-1">Version</th>
                      <th className="py-1">Title</th>
                      <th className="py-1">Published</th>
                      <th className="py-1 text-right">Accepted By</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {k.versions.map((v) => (
                      <tr key={v.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-1.5">
                          {v.version}{" "}
                          {v.current ? (
                            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800 dark:bg-green-900/40 dark:text-green-200">In force</span>
                          ) : null}
                        </td>
                        <td className="py-1.5">{v.title}</td>
                        <td className="py-1.5">{when(v.publishedAt)}</td>
                        <td className="py-1.5 text-right">{v.acceptances.toLocaleString()}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" className="mr-3 text-sm font-semibold text-blue-700 underline dark:text-blue-300" onClick={() => setReading(v)}>
                            Read
                          </button>
                          <button type="button" className="text-sm font-semibold text-blue-700 underline dark:text-blue-300" onClick={() => setViewing(v)}>
                            Who Accepted
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Nothing published yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {publishing ? (
        <PublishDialog
          kind={publishing}
          onClose={() => setPublishing(null)}
          onPublished={() => {
            setPublishing(null);
            load();
          }}
        />
      ) : null}
      {viewing ? <Acceptances doc={viewing} onClose={() => setViewing(null)} /> : null}
      {reading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={reading.title}>
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                {reading.title} <span className="text-sm font-semibold text-gray-500">version {reading.version}</span>
              </h2>
              <button type="button" className={button} onClick={() => setReading(null)}>
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">{reading.body}</div>
          </div>
        </div>
      ) : null}
    </GlobalLayout>
  );
}
