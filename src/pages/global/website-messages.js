import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";

// Website Messages (client sheet 10-29 (11), row 53): messages from the
// Ameris Solutions Contact Us page, which no longer go to Sales & Leads.

const card = "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button = "rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:bg-gray-900 dark:text-blue-200";

const when = (v) => new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** "Subject: message" as saved by the Contact Us form. */
function split(about) {
  const text = String(about || "");
  const i = text.indexOf(": ");
  return i > 0 && i < 40 ? { subject: text.slice(0, i), message: text.slice(i + 2) } : { subject: "", message: text };
}

export default function GlobalWebsiteMessages() {
  const router = useRouter();
  const [messages, setMessages] = useState(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiJson(`/api/v1/global/website-messages?${new URLSearchParams({ q })}`);
      setMessages(data.messages);
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the messages");
    }
  }, [q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    if (router.isReady && router.query.message) setOpenId(String(router.query.message));
  }, [router.isReady, router.query.message]);

  async function act(m, action) {
    if (action === "delete" && !window.confirm(`Delete the message from ${m.contactName}? This can't be undone.`)) return;
    setBusy(m.id);
    setError("");
    try {
      if (action === "delete") await apiJson(`/api/v1/global/leads/${m.id}`, { method: "DELETE" });
      else await apiJson("/api/v1/global/website-messages", { method: "PATCH", body: JSON.stringify({ id: m.id, action }) });
      if (action === "toLead") return router.push(`/global/leads?lead=${m.id}`);
      await load();
    } catch (e) {
      setError(e.message || "Could not update the message");
    } finally {
      setBusy("");
    }
  }

  async function open(m) {
    const next = openId === m.id ? "" : m.id;
    setOpenId(next);
    if (next && m.status === "NEW") act(m, "read");
  }

  const unread = (messages || []).filter((m) => m.status === "NEW").length;

  return (
    <GlobalLayout title="Website Messages">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Website Messages {unread ? <span className="ml-2 rounded-full bg-blue-700 px-2.5 py-0.5 align-middle text-sm text-white">{unread} new</span> : null}
        </h1>
        <input className={`${input} max-w-xs`} placeholder="Search name, email or message..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search messages" />
      </div>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Messages sent from the Contact Us page of the Ameris Solutions website. Move one to Sales &amp; Leads to follow up on it as a lead.</p>
      {error ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <div className={card}>
        {!messages ? (
          <p className="p-6 text-sm text-gray-500">Loading...</p>
        ) : !messages.length ? (
          <p className="p-6 text-sm text-gray-500">No messages from the website yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {messages.map((m) => {
              const { subject, message } = split(m.about);
              const isOpen = openId === m.id;
              return (
                <li key={m.id} className="p-4">
                  <button type="button" onClick={() => open(m)} aria-expanded={isOpen} className="flex w-full items-start justify-between gap-3 text-left">
                    <span className="min-w-0">
                      <span className={`block text-sm ${m.status === "NEW" ? "font-extrabold" : "font-semibold"} text-gray-900 dark:text-gray-100`}>
                        {m.status === "NEW" ? <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-600 align-middle" aria-label="New" /> : null}
                        {m.contactName} <span className="font-normal text-gray-500">· {m.email}</span>
                      </span>
                      <span className="block truncate text-sm text-gray-600 dark:text-gray-400">
                        {subject ? <b>{subject}: </b> : null}
                        {message}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{when(m.createdAt)}</span>
                  </button>
                  {isOpen ? (
                    <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800">
                      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
                        <dt className="font-bold">From</dt>
                        <dd>{m.contactName}</dd>
                        <dt className="font-bold">Email</dt>
                        <dd><a className="text-blue-700 underline" href={`mailto:${m.email}`}>{m.email}</a></dd>
                        {m.phone ? (
                          <>
                            <dt className="font-bold">Phone</dt>
                            <dd>{m.phone}</dd>
                          </>
                        ) : null}
                        {m.centerName && m.centerName !== "(not given)" ? (
                          <>
                            <dt className="font-bold">Center</dt>
                            <dd>{m.centerName}</dd>
                          </>
                        ) : null}
                        {subject ? (
                          <>
                            <dt className="font-bold">Subject</dt>
                            <dd>{subject}</dd>
                          </>
                        ) : null}
                      </dl>
                      <p className="whitespace-pre-wrap">{message}</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={button} disabled={busy === m.id} onClick={() => act(m, "toLead")}>
                          Move to Sales &amp; Leads
                        </button>
                        <button type="button" className={button} disabled={busy === m.id} onClick={() => act(m, "unread")}>
                          Mark as unread
                        </button>
                        <button type="button" className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:bg-gray-900" disabled={busy === m.id} onClick={() => act(m, "delete")}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </GlobalLayout>
  );
}
