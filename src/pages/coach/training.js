import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachActionCard,
  CoachBadge,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
} from "@/components/coach/CoachPage";

export default function CoachTraining() {
  return (
    <CoachLayout title="Training">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Training"
          title="Training tracking is not wired up yet, but coaches still have useful prep tools."
          description="A dedicated training progression backend is still pending. Until that lands, the coach workspace can still support preparation, reference checks, and follow-through."
          meta={
            <>
              <CoachBadge tone="amber">Training progression backend pending</CoachBadge>
              <CoachBadge tone="slate">Use these support tools in the meantime</CoachBadge>
            </>
          }
          stats={
            <>
              <CoachMetricCard
                label="Current State"
                value="Prep"
                hint="Reference and reinforcement workflows are available now"
                tone="amber"
                icon={<BookIcon />}
              />
              <CoachMetricCard
                label="Best Companion"
                value="Policies"
                hint="Quickest route to standards and procedures"
                tone="sky"
                icon={<GuideIcon />}
              />
              <CoachMetricCard
                label="Follow-through"
                value="Live"
                hint="Use observations and follow-ups to reinforce training"
                tone="emerald"
                icon={<CheckIcon />}
              />
              <CoachMetricCard
                label="Formal Tracking"
                value="Soon"
                hint="Staff progression views still need backend work"
                tone="rose"
                icon={<SparkIcon />}
              />
            </>
          }
        />

        <CoachPanel
          title="Use These Tools for Training Support"
          description="These existing pages are the strongest substitutes until the dedicated training module is implemented."
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <CoachActionCard
              href="/coach/policies"
              title="Policies and Procedures"
              description="Pull up operating standards while reviewing routines or coaching through issues."
              tone="sky"
              icon={<GuideIcon />}
            />
            <CoachActionCard
              href="/coach/observations"
              title="Observation Notes"
              description="Document what a teacher is doing well, what needs work, and what to reinforce next."
              tone="amber"
              icon={<EyeIcon />}
            />
            <CoachActionCard
              href="/coach/follow-ups"
              title="Training Follow-through"
              description="Assign specific next steps after coaching conversations or training reminders."
              tone="emerald"
              icon={<CheckIcon />}
            />
            <CoachActionCard
              href="/coach/messages"
              title="Coaching Communication"
              description="Keep post-training reminders and expectations in writing with the right staff members."
              tone="rose"
              icon={<ChatIcon />}
            />
          </div>
        </CoachPanel>

        <CoachPanel
          title="What the Future Training Module Should Cover"
          description="These are the missing capabilities once backend support is added."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FutureCard
              title="Assigned content"
              description="Coach-specific training plans, deadlines, and completion states."
            />
            <FutureCard
              title="Progress history"
              description="A record of completed modules, acknowledged materials, and growth over time."
            />
            <FutureCard
              title="Coaching loops"
              description="Direct links from training gaps to observations, notes, and follow-up actions."
            />
          </div>
        </CoachPanel>
      </div>
    </CoachLayout>
  );
}

function FutureCard({ title, description }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="text-sm font-black text-gray-900 dark:text-gray-100">{title}</div>
      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V5.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v10.5m0-10.5c-1.856-1.202-4.356-1.53-7.5-.984v10.968c3.144-.546 5.644-.218 7.5.984m0-10.968c1.856-1.202 4.356-1.53 7.5-.984v10.968c-3.144-.546-5.644-.218-7.5.984" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18l-1.147-2.096L5.757 15l2.096-1.147L9 11.757l.813 2.096L11.91 15l-2.097.904zM18 9l-.822 2.178L15 12l2.178.822L18 15l.822-2.178L21 12l-2.178-.822L18 9zM12 3l1.178 3.072L16 7.25l-2.822 1.178L12 11.5l-1.178-3.072L8 7.25l2.822-1.178L12 3z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25A2.25 2.25 0 1012 9.75a2.25 2.25 0 000 4.5z" />
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
