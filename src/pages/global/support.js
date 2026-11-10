import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import {
  AccessRow,
  button,
  card,
  Conversation,
  input,
  primary,
  TicketList,
  TICKET_STATUS_LABELS,
  when,
} from "@/components/support/SupportParts";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CLOSED", label: "Closed" },
];

function RequestAccess({ ticket, onRequest, saving }) {
  const [centerId, setCenterId] = useState(ticket.center?.id || ticket.accountCenters[0]?.id || "");
  const [reason, setReason] = useState("");
  if (!ticket.accountCenters.length) return <p className="text-sm text-gray-500">This subscriber has no centers.</p>;
  return (
    <form
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,220px)_1fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onRequest({ centerId, reason })) setReason("");
      }}
    >
      <label className="text-sm">
        <span className="sr-only">Center</span>
        <select className={input} value={centerId} onChange={(e) => setCenterId(e.target.value)} aria-label="Center">
          {ticket.accountCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <input className={input} placeholder="Reason (optional)" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="submit" className={primary} disabled={saving || !centerId}>
        Request Center Access
      </button>
    </form>
  );
}

function Detail({ id, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiJson(`/api/v1/global/support/${id}`)
      .then((t) => {
        setTicket(t);
        setError("");
      })
      .catch((err) => setError(err.message || "Could not load the ticket"));
  }, [id]);
  useEffect(load, [load]);

  async function send(path, method, body) {
    setSaving(true);
    try {
      const next = await apiJson(path, { method, body: JSON.stringify(body) });
      if (next?.messages) setTicket(next);
      else load();
      setError("");
      onChanged();
      return true;
    } catch (err) {
      setError(err.message || "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (!ticket) return <div className={card}>{error || "Loading..."}</div>;
  const liveGrants = ticket.accessGrants.filter((g) => g.status === "REQUESTED" || g.status === "GRANTED");
  const pastGrants = ticket.accessGrants.filter((g) => !liveGrants.includes(g));
  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">Ticket {ticket.number}</div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{ticket.subject}</h2>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {ticket.account.accountNumber} {ticket.account.name}
              {ticket.center ? ` · ${ticket.center.name}` : ""} · Opened by {ticket.openedBy?.name || ticket.openedBy?.email || "—"} {when(ticket.createdAt)}
            </div>
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Status</span>
            <select
              className={input}
              value={ticket.status}
              disabled={saving}
              onChange={(e) => send(`/api/v1/global/support/${id}`, "PATCH", { status: e.target.value })}
            >
              {Object.entries(TICKET_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Center Access</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The subscriber grants access from their Customer Support page. While it's granted, you can open that center from the Admin portal. It stays on until
          someone clicks End Access, even after the ticket is closed.
        </p>
        <div className="mt-2">
          {liveGrants.map((g) => (
            <AccessRow key={g.id} grant={g} side="AMERIS" saving={saving} onAction={(grant, action) => send(`/api/v1/global/support/access/${grant.id}`, "POST", { action })} />
          ))}
        </div>
        <RequestAccess ticket={ticket} saving={saving} onRequest={(requestAccess) => send(`/api/v1/global/support/${id}`, "POST", { requestAccess })} />
        {pastGrants.length ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-300">Earlier access ({pastGrants.length})</summary>
            {pastGrants.map((g) => (
              <AccessRow key={g.id} grant={g} side="AMERIS" saving={saving} onAction={() => {}} />
            ))}
          </details>
        ) : null}
      </div>

      <Conversation ticket={ticket} side="AMERIS" saving={saving} onReply={(reply) => send(`/api/v1/global/support/${id}`, "POST", { reply })} />
    </div>
  );
}

function NewTicketDialog({ onClose, onCreated }) {
  const [accounts, setAccounts] = useState([]);
  const [centers, setCenters] = useState([]);
  const [form, setForm] = useState({ accountId: "", centerId: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    apiJson("/api/v1/global/subscribers?status=ALL")
      .then((d) => setAccounts(d.subscribers || []))
      .catch(() => setAccounts([]));
  }, []);
  useEffect(() => {
    if (!form.accountId) return setCenters([]);
    apiJson(`/api/v1/global/subscribers/${form.accountId}`)
      .then((d) => setCenters(d.centers || []))
      .catch(() => setCenters([]));
  }, [form.accountId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New Ticket">
      <form
        className={`${card} w-full max-w-lg space-y-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const created = await apiJson("/api/v1/global/support", { method: "POST", body: JSON.stringify(form) });
            onCreated(created);
          } catch (err) {
            setError(err.message || "Could not open the ticket");
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">New Ticket</h2>
        {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Subscriber</span>
          <select className={input} value={form.accountId} onChange={(e) => set({ accountId: e.target.value, centerId: "" })} required>
            <option value="">Pick a subscriber</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountNumber} {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Center (optional)</span>
          <select className={input} value={form.centerId} onChange={(e) => set({ centerId: e.target.value })}>
            <option value="">Whole account</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Subject</span>
          <input className={input} value={form.subject} onChange={(e) => set({ subject: e.target.value })} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Description</span>
          <textarea className={input} rows={4} value={form.body} onChange={(e) => set({ body: e.target.value })} required />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Opening..." : "Open Ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function GlobalSupportPage() {
  const router = useRouter();
  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ tickets: [], counts: {} });
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiJson(`/api/v1/global/support?${new URLSearchParams({ status: tab, q })}`));
      setError("");
    } catch (err) {
      setError(err.message || "Could not load tickets");
    }
  }, [tab, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // A notification link opens its ticket.
  useEffect(() => {
    if (router.isReady && router.query.ticket) setSelected(String(router.query.ticket));
  }, [router.isReady, router.query.ticket]);

  useEffect(() => {
    if (!selected && data.tickets.length) setSelected(data.tickets[0].id);
  }, [data.tickets, selected]);

  const counts = data.counts || {};
  const stats = [
    { label: "Open", value: counts.OPEN || 0, tab: "OPEN" },
    { label: "In Progress", value: counts.IN_PROGRESS || 0, tab: "IN_PROGRESS" },
    { label: "Closed", value: counts.CLOSED || 0, tab: "CLOSED" },
    { label: "Centers With Access", value: counts.ACCESS_GRANTED || 0 },
  ];

  return (
    <GlobalLayout title="Customer Support">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Customer Support</h1>
        <button type="button" className={button} onClick={() => setAdding(true)}>
          + New Ticket
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => s.tab && setTab(s.tab)}
            className={`${card} text-left ${s.tab ? "hover:border-blue-400" : "cursor-default"}`}
          >
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{s.label}</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{s.value}</div>
          </button>
        ))}
      </div>

      {error ? <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className={card}>
          <input className={input} placeholder="Search by ticket, subject or subscriber..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="my-3 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-bold",
                  tab === t.key
                    ? "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100"
                    : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300",
                ].join(" ")}
              >
                {t.label} ({counts[t.key] || 0})
              </button>
            ))}
          </div>
          <TicketList tickets={data.tickets} selected={selected} onSelect={setSelected} showAccount />
        </div>
        <div>{selected ? <Detail key={selected} id={selected} onChanged={load} /> : <div className={card}>No tickets yet.</div>}</div>
      </div>

      {adding ? (
        <NewTicketDialog
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setAdding(false);
            setTab("ALL");
            setSelected(created.id);
            load();
          }}
        />
      ) : null}
    </GlobalLayout>
  );
}
