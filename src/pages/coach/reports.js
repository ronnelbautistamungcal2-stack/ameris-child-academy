import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachActionCard,
  CoachBadge,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
} from "@/components/coach/CoachPage";

export default function CoachReports() {
  return (
    <CoachLayout title="Reports">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Reporting"
          title="Coach reporting is partially built and still expanding."
          description="Dedicated analytics screens are not implemented in the backend yet, but the coach workspace already exposes several strong reporting views you can use today."
          meta={
            <>
              <CoachBadge tone="amber">Analytics builder coming later</CoachBadge>
              <CoachBadge tone="slate">Use current operational views below</CoachBadge>
            </>
          }
          stats={
            <>
              <CoachMetricCard
                label="Available Now"
                value="4"
                hint="Operational report surfaces"
                tone="sky"
                icon={<ChartIcon />}
              />
              <CoachMetricCard
                label="Best Source"
                value="Dashboard"
                hint="Fastest view for center oversight"
                tone="amber"
                icon={<GridIcon />}
              />
              <CoachMetricCard
                label="Behavior"
                value="Soon"
                hint="Cross-screen analytics still pending"
                tone="rose"
                icon={<SparkIcon />}
              />
              <CoachMetricCard
                label="Current Focus"
                value="Execution"
                hint="Observations, compliance, and follow-through"
                tone="emerald"
                icon={<CheckIcon />}
              />
            </>
          }
        />

        <CoachPanel
          title="Reporting Paths Available Today"
          description="These pages already function as practical reporting surfaces while the dedicated analytics backend is still in progress."
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <CoachActionCard
              href="/coach/dashboard"
              title="Operational Dashboard"
              description="Cross-check overdue alarms, open follow-ups, classroom coverage, and recent observations."
              tone="sky"
              icon={<GridIcon />}
            />
            <CoachActionCard
              href="/coach/compliance"
              title="Compliance Review"
              description="Identify teachers who need logging follow-up and compare 24-hour versus 7-day activity."
              tone="emerald"
              icon={<CheckIcon />}
            />
            <CoachActionCard
              href="/coach/observations"
              title="Observation History"
              description="Review scores, strengths, coaching notes, and action items by teacher or observation type."
              tone="amber"
              icon={<EyeIcon />}
            />
            <CoachActionCard
              href="/coach/follow-ups"
              title="Follow-up Queue"
              description="Track outstanding work by priority, status, assignee, and due date."
              tone="rose"
              icon={<ListIcon />}
            />
          </div>
        </CoachPanel>

        <CoachPanel
          title="What Is Still Missing"
          description="These areas need backend support before this page can become a true analytics center."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FutureCard
              title="Trendlines"
              description="Longitudinal improvement reporting across teachers and centers."
            />
            <FutureCard
              title="Exportable Reports"
              description="Structured summaries for leadership reviews and coaching cycles."
            />
            <FutureCard
              title="Comparative Analytics"
              description="Side-by-side center and teacher benchmarking beyond current operational views."
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

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15M7.5 16.5v-6m4.5 6V4.5m4.5 12v-9" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h6.5v6.5h-6.5zm10 0h6.5v6.5h-6.5zm-10 10h6.5v6.5h-6.5zm10 0h6.5v6.5h-6.5z" />
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 7.5h.008v.008H3.75V7.5zm0 5.25h.008v.008H3.75v-.008zm0 5.25h.008v.008H3.75V18z" />
    </svg>
  );
}
