// Pieces shared by Admin > Customer Support and the Ameris Solutions
// Customer Support queue (client 2026-11-07, step F).
import { useState } from "react";

export const TICKET_STATUS_LABELS = { OPEN: "Open", IN_PROGRESS: "In Progress", CLOSED: "Closed" };
export const ACCESS_STATUS_LABELS = { REQUESTED: "Requested", GRANTED: "Granted", DECLINED: "Declined", ENDED: "Ended" };

const TICKET_CLASS = {
  OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  CLOSED: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const ACCESS_CLASS = {
  REQUESTED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  GRANTED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  DECLINED: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ENDED: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";
export const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
export const button =
  "rounded-xl border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
export const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";
export const danger =
  "rounded-xl border border-red-600 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-900/30";

export function TicketStatusPill({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TICKET_CLASS[status] || TICKET_CLASS.CLOSED}`}>
      {TICKET_STATUS_LABELS[status] || status}
    </span>
  );
}

export function AccessPill({ status, prefix = "" }) {
  if (!status) return null;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ACCESS_CLASS[status] || ACCESS_CLASS.ENDED}`}>
      {prefix}
      {ACCESS_STATUS_LABELS[status] || status}
    </span>
  );
}

export function when(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function who(person, fallback) {
  return person?.name || person?.email || fallback;
}

/** Left-hand ticket list. */
export function TicketList({ tickets, selected, onSelect, showAccount }) {
  if (!tickets.length) return <p className="py-6 text-center text-sm text-gray-500">No tickets.</p>;
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {tickets.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={[
            "block w-full rounded-xl px-2 py-2.5 text-left",
            selected === t.id ? "bg-blue-50 dark:bg-blue-900/30" : t.accessStatus === "REQUESTED" ? "bg-amber-50/60 dark:bg-amber-900/10" : "",
          ].join(" ")}
        >
          <span className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.number}</span>
            <TicketStatusPill status={t.status} />
            <AccessPill status={t.accessStatus} prefix="Access " />
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold text-gray-900 dark:text-gray-100">{t.subject}</span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {showAccount ? `${t.account?.accountNumber} ${t.account?.name} · ` : ""}
            {when(t.updatedAt)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The ticket's conversation, with a reply box. */
export function Conversation({ ticket, side, onReply, saving }) {
  const [reply, setReply] = useState("");
  const mine = (m) => (side === "AMERIS" ? m.fromAmeris : !m.fromAmeris);
  return (
    <div className={card}>
      <h3 className="mb-3 text-lg font-extrabold text-gray-900 dark:text-gray-100">Conversation</h3>
      <div className="space-y-2">
        {ticket.messages.map((m) =>
          m.isEvent ? (
            <div key={m.id} className="text-center text-xs text-gray-500 dark:text-gray-400">
              {m.body} · {who(m.author, m.fromAmeris ? "Ameris Solutions" : "Subscriber")} · {when(m.createdAt)}
            </div>
          ) : (
            <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`}>
              <div
                className={[
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  mine(m) ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
                ].join(" ")}
              >
                <div className={`text-xs font-bold ${mine(m) ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>
                  {who(m.author, m.fromAmeris ? "Ameris Solutions" : "Subscriber")}
                  {m.fromAmeris ? " (Ameris Solutions)" : ""} · {when(m.createdAt)}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          ),
        )}
      </div>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onReply(reply)) setReply("");
        }}
      >
        <label htmlFor="support-reply" className="sr-only">
          Reply
        </label>
        <textarea id="support-reply" className={input} rows={3} placeholder="Write a reply..." value={reply} onChange={(e) => setReply(e.target.value)} />
        <div className="flex justify-end">
          <button type="submit" className={primary} disabled={!reply.trim() || saving}>
            {saving ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** One access grant line, with the buttons this side may press. */
export function AccessRow({ grant, side, onAction, saving }) {
  const live = grant.status === "REQUESTED" || grant.status === "GRANTED";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 py-2 first:border-t-0 dark:border-gray-800">
      <div className="text-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 dark:text-gray-100">{grant.center?.name}</span>
          <AccessPill status={grant.status} />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Requested by {who(grant.requestedBy, "Ameris Solutions")} {when(grant.createdAt)}
          {grant.answeredAt ? ` · ${grant.status === "DECLINED" ? "Declined" : "Granted"} by ${who(grant.answeredBy, "subscriber")} ${when(grant.answeredAt)}` : ""}
          {grant.endedAt ? ` · Ended by ${who(grant.endedBy, "")} ${when(grant.endedAt)}` : ""}
        </div>
        {grant.reason ? <div className="text-xs text-gray-600 dark:text-gray-300">Reason: {grant.reason}</div> : null}
      </div>
      {live ? (
        <div className="flex gap-2">
          {side === "SUBSCRIBER" && grant.status === "REQUESTED" ? (
            <>
              <button type="button" className={primary} disabled={saving} onClick={() => onAction(grant, "GRANT")}>
                Grant Access
              </button>
              <button type="button" className={button} disabled={saving} onClick={() => onAction(grant, "DECLINE")}>
                Decline
              </button>
            </>
          ) : null}
          {grant.status === "GRANTED" ? (
            <button type="button" className={danger} disabled={saving} onClick={() => onAction(grant, "END")}>
              End Access
            </button>
          ) : null}
          {side === "AMERIS" && grant.status === "REQUESTED" ? (
            <button type="button" className={button} disabled={saving} onClick={() => onAction(grant, "END")}>
              Withdraw Request
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
