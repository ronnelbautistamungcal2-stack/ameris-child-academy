import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import {
  AccessRow,
  button,
  card,
  Conversation,
  input,
  primary,
  TicketList,
  TicketStatusPill,
  when,
} from "@/components/support/SupportParts";

// Admin > Customer Support (client 2026-11-07, step F): tickets to Ameris
// Solutions, and Ameris's requests to look at one of the subscriber's centers.

function Detail({ id, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiJson(`/api/v1/support/tickets/${id}`)
      .then((t) => {
        setTicket(t);
        setError("");
      })
      .catch((err) => setError(err.message || "Could not load the ticket"));
  }, [id]);
  useEffect(load, [load]);

  async function send(path, body) {
    setSaving(true);
    try {
      const next = await apiJson(path, { method: "POST", body: JSON.stringify(body) });
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
  const closed = ticket.status === "CLOSED";
  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              Ticket {ticket.number} <TicketStatusPill status={ticket.status} />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{ticket.subject}</h2>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {ticket.center ? `${ticket.center.name} · ` : ""}Opened {when(ticket.createdAt)}
            </div>
          </div>
          <button type="button" className={button} disabled={saving} onClick={() => send(`/api/v1/support/tickets/${id}`, { action: closed ? "REOPEN" : "CLOSE" })}>
            {closed ? "Reopen Ticket" : "Close Ticket"}
          </button>
        </div>
      </div>

      {ticket.accessGrants.length ? (
        <div className={card}>
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Center Access</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Granting lets Ameris Solutions support staff open that center to look into this problem. Access stays on until you or Ameris click End Access.
          </p>
          <div className="mt-2">
            {liveGrants.map((g) => (
              <AccessRow key={g.id} grant={g} side="SUBSCRIBER" saving={saving} onAction={(grant, action) => send(`/api/v1/support/access/${grant.id}`, { action })} />
            ))}
            {!liveGrants.length ? <p className="text-sm text-gray-500">Ameris Solutions doesn't have access to any of your centers.</p> : null}
          </div>
          {pastGrants.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-300">Earlier access ({pastGrants.length})</summary>
              {pastGrants.map((g) => (
                <AccessRow key={g.id} grant={g} side="SUBSCRIBER" saving={saving} onAction={() => {}} />
              ))}
            </details>
          ) : null}
        </div>
      ) : null}

      <Conversation ticket={ticket} side="SUBSCRIBER" saving={saving} onReply={(reply) => send(`/api/v1/support/tickets/${id}`, { reply })} />
    </div>
  );
}

function NewTicketDialog({ onClose, onCreated }) {
  const [centers, setCenters] = useState([]);
  const [form, setForm] = useState({ centerId: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((list) => setCenters(Array.isArray(list) ? list : []))
      .catch(() => setCenters([]));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New Ticket">
      <form
        className={`${card} w-full max-w-lg space-y-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            onCreated(await apiJson("/api/v1/support/tickets", { method: "POST", body: JSON.stringify(form) }));
          } catch (err) {
            setError(err.message || "Could not open the ticket");
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Contact Ameris Solutions Support</h2>
        {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Center (optional)</span>
          <select className={input} value={form.centerId} onChange={(e) => set({ centerId: e.target.value })}>
            <option value="">All centers / not center-specific</option>
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
          <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">What's going on?</span>
          <textarea className={input} rows={5} value={form.body} onChange={(e) => set({ body: e.target.value })} required />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Sending..." : "Send to Support"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setTickets((await apiJson("/api/v1/support/tickets")).tickets || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load your tickets");
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (router.isReady && router.query.ticket) setSelected(String(router.query.ticket));
  }, [router.isReady, router.query.ticket]);
  useEffect(() => {
    if (!selected && tickets.length) setSelected((tickets.find((t) => t.accessStatus === "REQUESTED") || tickets[0]).id);
  }, [tickets, selected]);

  const waiting = tickets.filter((t) => t.accessStatus === "REQUESTED").length;

  return (
    <AdminLayout title="Customer Support">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Customer Support</h1>
        <button type="button" className={primary} onClick={() => setAdding(true)}>
          + New Ticket
        </button>
      </div>
      {waiting ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
          Ameris Solutions is asking for access to your center on {waiting === 1 ? "1 ticket" : `${waiting} tickets`}. Open the ticket to grant or decline.
        </div>
      ) : null}
      {error ? <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {loaded && !tickets.length && !error ? (
        <div className={`${card} text-center`}>
          <p className="text-sm text-gray-600 dark:text-gray-300">No support tickets yet. Need help? Open a ticket and the Ameris Solutions team will reply here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className={card}>
            <TicketList tickets={tickets} selected={selected} onSelect={setSelected} />
          </div>
          <div>{selected ? <Detail key={selected} id={selected} onChanged={load} /> : null}</div>
        </div>
      )}

      {adding ? (
        <NewTicketDialog
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setAdding(false);
            setSelected(created.id);
            load();
          }}
        />
      ) : null}
    </AdminLayout>
  );
}
