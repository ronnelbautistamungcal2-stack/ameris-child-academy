import { useEffect, useState } from "react";
import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachBadge,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachInputClass,
} from "@/components/coach/CoachPage";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import MessageInbox from "@/components/messages/MessageInbox";
import { apiJson } from "@/lib/api";

export default function CoachMessages() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  useSyncedCenterId(centerId, setCenterId, centers, {
    blankQueryValue: "all",
  });

  useEffect(() => {
    (async () => {
      try {
        const response = await apiJson("/api/v1/centers");
        const nextCenters = Array.isArray(response) ? response : [];
        setCenters(nextCenters);
      } catch {
        setCenters([]);
      }
    })();
  }, []);

  const activeCenterName = centers.find((center) => center.id === centerId)?.name || "";

  return (
    <CoachLayout title="Messages">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Communication Hub"
          title="Keep coaching conversations close to the operational work."
          description="Use messaging to close the loop on observations, follow-ups, and routine expectations without losing the center context."
          meta={
            <>
              {activeCenterName ? <CoachBadge tone="sky">{activeCenterName}</CoachBadge> : null}
              <CoachBadge tone="slate">
                {centerId ? "Inbox filtered to this center" : "Viewing all available conversations"}
              </CoachBadge>
            </>
          }
          controls={
            <label className="block">
              <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Center Filter
              </div>
              <select
                value={centerId}
                onChange={(event) => setCenterId(event.target.value)}
                className={coachInputClass}
              >
                <option value="">All conversations</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
          }
          stats={
            <>
              <CoachMetricCard
                label="Scope"
                value={centerId ? "Center" : "All"}
                hint={centerId ? "Messages limited to selected center" : "Showing every accessible thread"}
                tone="sky"
                icon={<CenterIcon />}
              />
              <CoachMetricCard
                label="Use Case"
                value="Coach"
                hint="Observations, reminders, and follow-through"
                tone="amber"
                icon={<ChatIcon />}
              />
              <CoachMetricCard
                label="Best For"
                value="Fast alignment"
                hint="Keep teacher communication tied to active work"
                tone="emerald"
                icon={<BoltIcon />}
              />
              <CoachMetricCard
                label="Context"
                value={activeCenterName || "Shared"}
                hint="Current conversation lens"
                tone="slate"
                icon={<PinIcon />}
              />
            </>
          }
        />

        <CoachPanel
          title="Coach Inbox"
          description="The inbox below stays fully interactive and respects the selected center filter when one is applied."
          padded={false}
          className="overflow-hidden"
        >
          <MessageInbox centerId={centerId || undefined} />
        </CoachPanel>
      </div>
    </CoachLayout>
  );
}

function CenterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M6.75 18V6.75A2.25 2.25 0 019 4.5h6a2.25 2.25 0 012.25 2.25V18M9.75 9.75h.008v.008H9.75V9.75zm0 3h.008v.008H9.75v-.008zm4.5-3h.008v.008h-.008V9.75zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 9.75h9m-9 3h5.25m-8.25 7.5l3.07-3.07a1.5 1.5 0 011.06-.44H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h.94a1.5 1.5 0 011.06.44l.75.75" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 2.25L6.75 12h4.5l-.75 9.75L17.25 12h-4.5l.75-9.75z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-4.35 6-10.125A6 6 0 106 10.875C6 16.65 12 21 12 21z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a1.875 1.875 0 100-3.75 1.875 1.875 0 000 3.75z" />
    </svg>
  );
}
