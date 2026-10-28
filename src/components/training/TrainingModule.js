import { NAVY, StatusPill } from "@/components/training/trainingUi";
import { apiJson } from "@/lib/api";
import { useState } from "react";

// One training as the staff member works through it (client mockup 02):
// materials to view, the observation / hands-on requests that message the
// coach, and the acknowledgment that completes it.

const KIND_ICON = { ATTACHMENT: "📄", LINK: "🔗", VIDEO: "🎬" };
const KIND_ACTION = { ATTACHMENT: "View", LINK: "Open", VIDEO: "Watch" };
const REQUEST_PILL = {
  NONE: ["Not Requested", "bg-gray-100 text-gray-600"],
  REQUESTED: ["Requested", "bg-amber-100 text-amber-800"],
  COMPLETED: ["Completed", "bg-emerald-100 text-emerald-800"],
};

export default function TrainingModule({ item, progress, heading, onChanged }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const p = progress || { status: "NOT_STARTED", materialsViewed: [], observationStatus: "NONE", handsOnStatus: "NONE" };
  const viewed = Array.isArray(p.materialsViewed) ? p.materialsViewed : [];

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await apiJson(`/api/v1/training/items/${item.id}/progress`, { method: "PUT", body: JSON.stringify({ action, ...extra }) });
      if (action === "requestObservation" || action === "requestHandsOn") setNotice("Your request was sent to your coach.");
      await onChanged();
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  function openMaterial(m, index) {
    window.open(m.url, "_blank", "noopener,noreferrer");
    if (!viewed.includes(index)) act("viewMaterial", { materialIndex: index });
  }

  const requests = [
    item.observationRequired && {
      key: "observation",
      status: p.observationStatus,
      action: "requestObservation",
      title: "Observation Requirement",
      text: "After completing the training materials, you will need to be observed by your supervisor to demonstrate understanding of key policies and procedures.",
      button: "Request to Schedule Observation",
      tone: "bg-amber-50 border-amber-200",
    },
    item.handsOnRequired && {
      key: "handsOn",
      status: p.handsOnStatus,
      action: "requestHandsOn",
      title: "Hands-On Experience",
      text: "You need hands-on experience with a supervisor to practice key skills related to this training.",
      button: "Request Hands-On Experience",
      tone: "bg-violet-50 border-violet-200",
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {heading ? <div className="text-sm text-gray-500">{heading}</div> : null}
          <h2 className={`text-2xl font-black ${NAVY}`}>{item.title}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
        </div>
        <StatusPill status={p.status} />
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className={`text-sm font-bold ${NAVY}`}>Training Materials</div>
        {item.materials.length ? (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {item.materials.map((m, i) => (
              <li key={`${m.url}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden>{KIND_ICON[m.kind]}</span>
                  <span>
                    <span className="block text-sm font-semibold">{m.name}</span>
                    <span className="block text-xs text-gray-500">{viewed.includes(i) ? "Viewed" : m.kind === "ATTACHMENT" ? "Document" : m.kind === "VIDEO" ? "Video" : "Website"}</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => openMaterial(m, i)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold ${viewed.includes(i) ? "bg-emerald-600 text-white" : "border border-blue-300 text-blue-700 hover:bg-blue-50"}`}
                >
                  {viewed.includes(i) ? "Viewed ✓" : KIND_ACTION[m.kind]}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No materials were added to this training.</p>
        )}
      </div>

      {requests.map((r) => {
        const [pillText, pillTone] = REQUEST_PILL[r.status] || REQUEST_PILL.NONE;
        return (
          <div key={r.key} className={`rounded-xl border p-4 ${r.tone} dark:border-gray-700 dark:bg-gray-800`}>
            <div className="flex items-start justify-between gap-3">
              <div className={`text-sm font-bold ${NAVY}`}>{r.title}</div>
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${pillTone}`}>{pillText}</span>
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{r.text}</p>
            {r.status !== "COMPLETED" ? (
              <button
                type="button"
                onClick={() => act(r.action)}
                disabled={Boolean(busy)}
                className="mt-2 rounded-lg border border-blue-300 bg-white px-4 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
              >
                {r.status === "REQUESTED" ? "Send Request Again" : r.button}
              </button>
            ) : null}
          </div>
        );
      })}

      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className={`text-sm font-bold ${NAVY}`}>Acknowledgment</div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(p.acknowledgedAt)}
            disabled={Boolean(p.acknowledgedAt) || Boolean(busy)}
            onChange={() => act("complete")}
          />
          I have reviewed and understand the information in this training.
        </label>
        {p.acknowledgedAt && p.status !== "COMPLETED" ? (
          <p className="mt-1 text-xs text-gray-500">This training will be marked complete once your supervisor signs off the requirements above.</p>
        ) : null}
      </div>
    </div>
  );
}
