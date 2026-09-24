import ParentLayout from "@/components/parent/ParentLayout";
import { ParentEmpty, ParentSurface } from "@/components/parent/ParentUI";
import ChildSnapshotDialog from "@/components/parent/ChildSnapshotDialog";
import StudentPerformanceReportPanel from "@/components/reports/StudentPerformanceReportPanel";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { ageInYears, formatAgeLong } from "@/lib/ageUtils";
import { CHILD_SNAPSHOT_FIELDS } from "@/lib/childSnapshot";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function ParentChildren() {
  const router = useRouter();
  const routeChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingSnapshot, setEditingSnapshot] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadChildren() {
      setChildrenLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        if (cancelled) return;
        const sorted = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          (a.firstName || "").localeCompare(b.firstName || ""),
        );
        setChildren(sorted);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load children");
      } finally {
        if (!cancelled) setChildrenLoading(false);
      }
    }

    loadChildren();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!children.length) {
      setSelectedChildId("");
      return;
    }
    if (routeChildId && children.some((child) => child.id === routeChildId)) {
      setSelectedChildId(routeChildId);
      return;
    }
    setSelectedChildId((current) => {
      if (current && children.some((child) => child.id === current)) return current;
      return children[0]?.id || "";
    });
  }, [children, routeChildId]);

  useEffect(() => {
    if (!router.isReady) return;
    if (childrenLoading) return;
    const currentChild =
      typeof router.query.childId === "string" ? router.query.childId : "";
    if (currentChild === selectedChildId) return;

    const nextQuery = { ...router.query };
    if (selectedChildId) nextQuery.childId = selectedChildId;
    else delete nextQuery.childId;

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
      scroll: false,
    });
  }, [router, selectedChildId, childrenLoading]);

  const selectedChild = useMemo(
    () => children.find((ch) => ch.id === selectedChildId) || null,
    [children, selectedChildId],
  );

  // A snapshot save returns only the snapshot fields, so patch them onto the
  // child already in state instead of refetching the whole family.
  const applySnapshot = useCallback((childId, snapshot) => {
    setChildren((current) =>
      current.map((child) => {
        if (child.id !== childId) return child;
        const next = { ...child };
        for (const field of CHILD_SNAPSHOT_FIELDS) {
          next[field] = snapshot?.[field] ?? null;
        }
        return next;
      }),
    );
  }, []);

  // The switcher sticks under the app header; once the page scrolls past its
  // natural position it collapses into a single row so it keeps every child
  // reachable without eating the viewport.
  const switcherRef = useRef(null);
  const [switcherCondensed, setSwitcherCondensed] = useState(false);

  useEffect(() => {
    const switcher = switcherRef.current;
    if (!switcher) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const headerHeight =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--app-header-h"),
        ) || 0;
      setSwitcherCondensed(switcher.getBoundingClientRect().top <= headerHeight + 1);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [childrenLoading]);

  // Condensed, the rail is one horizontal row, so a large family scrolls
  // sideways. Keep the selected child centred and flag the edges that still
  // have names past them so nobody has to guess the row scrolls.
  const railRef = useRef(null);
  const [railEdges, setRailEdges] = useState({ start: false, end: false });

  const measureRailEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setRailEdges({
      start: rail.scrollLeft > 4,
      end: maxScroll > 4 && rail.scrollLeft < maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    if (!switcherCondensed) {
      setRailEdges({ start: false, end: false });
      return undefined;
    }
    const rail = railRef.current;
    if (!rail) return undefined;

    const active = rail.querySelector('[data-child-chip-active="true"]');
    if (active) {
      // scrollTo on the rail itself, never scrollIntoView, so centring the
      // chip cannot drag the page vertically out from under the reader.
      rail.scrollTo({
        left: Math.max(
          0,
          active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2,
        ),
        behavior: "smooth",
      });
    }

    measureRailEdges();
    rail.addEventListener("scroll", measureRailEdges, { passive: true });
    window.addEventListener("resize", measureRailEdges);
    return () => {
      rail.removeEventListener("scroll", measureRailEdges);
      window.removeEventListener("resize", measureRailEdges);
    };
  }, [switcherCondensed, selectedChildId, children.length, measureRailEdges]);

  return (
    <ParentLayout title="My Children">
      <div className="space-y-3">
        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <PageHeading icon={<UsersIcon />}>My Children</PageHeading>

        <div
          ref={switcherRef}
          className="sticky z-[5]"
          style={{ top: "var(--app-header-h, 64px)" }}
        >
          <section
            className={[
              "rounded-[28px] border border-sky-100 bg-white shadow-sm dark:border-sky-900/60 dark:bg-gray-800",
              switcherCondensed
                ? "p-2.5 shadow-[0_18px_40px_-28px_rgba(14,116,144,0.55)]"
                : "p-3",
            ].join(" ")}
          >
            {childrenLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} variant="card" className="h-[52px] w-[168px] rounded-2xl" />
                ))}
              </div>
            ) : children.length === 0 ? (
              <ParentEmpty
                title="No children found"
                description="No children are linked to your account yet. Please contact your center administrator."
              />
            ) : (
              <div className="relative">
                <div
                  ref={railRef}
                  className={
                    switcherCondensed
                      ? "scrollbar-hide flex items-stretch gap-2 overflow-x-auto"
                      : "flex flex-wrap items-stretch gap-2"
                  }
                >
                  {children.map((child) => (
                    <ChildSwitcherChip
                      key={child.id}
                      child={child}
                      active={child.id === selectedChildId}
                      onSelect={() => setSelectedChildId(child.id)}
                    />
                  ))}
                </div>
                {switcherCondensed ? (
                  <>
                    <RailEdgeFade side="left" visible={railEdges.start} />
                    <RailEdgeFade side="right" visible={railEdges.end} />
                  </>
                ) : null}
              </div>
            )}
          </section>
        </div>

        {selectedChild ? (
          <div className="space-y-3">
            <ChildProfileCard
              child={selectedChild}
              onEditSnapshot={() => setEditingSnapshot(true)}
            />

            <ParentSurface>
              <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4 dark:border-gray-700">
                <SectionIcon tone="sky">
                  <ChartIcon />
                </SectionIcon>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-gray-900 dark:text-gray-100">
                    Student Performance Report
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    Goals, grades, milestones, accomplishments, and activity for your child.
                  </p>
                </div>
              </div>
              <div className="pt-4">
                <StudentPerformanceReportPanel childId={selectedChildId} />
              </div>
            </ParentSurface>
          </div>
        ) : null}
      </div>

      {editingSnapshot && selectedChild ? (
        <ChildSnapshotDialog
          child={selectedChild}
          onClose={() => setEditingSnapshot(false)}
          onSaved={(snapshot) => {
            applySnapshot(selectedChild.id, snapshot);
            setEditingSnapshot(false);
          }}
        />
      ) : null}
    </ParentLayout>
  );
}

function PageHeading({ icon, children }) {
  return (
    <div className="flex items-center gap-2.5">
      <SectionIcon tone="sky">{icon}</SectionIcon>
      <h1 className="text-xl font-black tracking-tight text-[#12386a] dark:text-gray-100 sm:text-2xl">
        {children}
      </h1>
    </div>
  );
}

function ChildProfileCard({ child, onEditSnapshot }) {
  const teachers = teacherNames(child);

  return (
    <section className="rounded-[28px] border-2 border-sky-500 bg-white p-4 shadow-[0_0_0_4px_rgba(186,230,253,0.55)] dark:border-sky-600 dark:bg-gray-800 dark:shadow-[0_0_0_4px_rgba(12,74,110,0.5)] sm:p-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex items-start gap-4">
          <ChildAvatar child={child} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black tracking-tight text-[#12386a] dark:text-gray-100">
              {child.firstName} {child.lastName || ""}
            </h2>
            <dl className="mt-2 space-y-1">
              <MetaRow label="Age" value={displayAge(child.birthDate)} />
              <MetaRow label="Room" value={child.classRoom?.name || "Unassigned"} />
              <MetaRow label="Teacher" value={teachers || "Not assigned"} />
              <MetaRow label="Start Date" value={formatLongDate(child.enrollmentStartDate)} />
            </dl>
          </div>
        </div>

        <div className="rounded-[20px] border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black tracking-tight text-[#12386a] dark:text-gray-100">
              Child Snapshot
            </h3>
            <button
              type="button"
              onClick={onEditSnapshot}
              className="rounded-full bg-sky-600 px-3.5 py-1 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-sky-700"
            >
              Edit
            </button>
          </div>
          <dl className="mt-2.5 space-y-1">
            <MetaRow label="Favorite Activities" value={child.favoriteActivities} />
            <MetaRow label="Strengths" value={child.strengths} />
            <MetaRow label="Areas of Focus" value={child.areasOfFocus} />
            <MetaRow label="Allergies" value={child.allergies || "None"} />
            <MetaRow label="Notes" value={child.snapshotNotes} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex gap-1.5 text-[13px] leading-5">
      <dt className="shrink-0 font-bold text-gray-500 dark:text-gray-400">{label}:</dt>
      <dd className="min-w-0 text-gray-800 dark:text-gray-200">{value || "—"}</dd>
    </div>
  );
}

function ChildSwitcherChip({ child, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      data-child-chip-active={active ? "true" : "false"}
      className={[
        "flex w-[168px] shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-sky-400 bg-sky-50 ring-2 ring-sky-100 dark:border-sky-600 dark:bg-sky-950/60 dark:ring-sky-900/60"
          : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/70 dark:border-gray-700 dark:bg-slate-900 dark:hover:border-sky-800",
      ].join(" ")}
    >
      <ChildAvatar child={child} size="sm" />
      <span className="min-w-0 flex-1">
        <span
          className={[
            "block truncate text-[12px] font-extrabold",
            active ? "text-sky-900 dark:text-sky-100" : "text-gray-800 dark:text-gray-200",
          ].join(" ")}
        >
          {child.firstName} {lastInitial(child.lastName)}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">
          {formatAgeLong(child.birthDate) || "Age unavailable"}
        </span>
      </span>
    </button>
  );
}

function ChildAvatar({ child, size = "sm" }) {
  const [broken, setBroken] = useState(false);
  const dims = {
    sm: "h-9 w-9 text-[11px]",
    lg: "h-[88px] w-[88px] text-2xl",
  };
  const shape = size === "lg" ? "rounded-[20px]" : "rounded-full";
  const photo = typeof child?.photoUrl === "string" ? child.photoUrl.trim() : "";

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={`${child.firstName || "Child"} ${child.lastName || ""}`.trim()}
        onError={() => setBroken(true)}
        className={`${dims[size]} ${shape} shrink-0 border border-sky-100 object-cover dark:border-sky-900/60`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dims[size]} ${shape} grid shrink-0 place-items-center bg-gradient-to-br from-sky-600 to-cyan-500 font-black text-white`}
    >
      {initials(child?.firstName, child?.lastName)}
    </span>
  );
}

function RailEdgeFade({ side, visible }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute inset-y-0 w-8",
        side === "left"
          ? "left-0 bg-gradient-to-r from-white to-transparent dark:from-gray-800"
          : "right-0 bg-gradient-to-l from-white to-transparent dark:from-gray-800",
      ].join(" ")}
    />
  );
}

function SectionIcon({ tone = "sky", children }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  };
  return (
    <span
      aria-hidden="true"
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[tone] || tones.sky}`}
    >
      {children}
    </span>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.38M15.5 5.2a3 3 0 0 1 0 5.6" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M7 20v-7M12 20V6M17 20v-4" />
    </svg>
  );
}

/**
 * Whole years once a child has one, because that is how families say it. Under
 * a year, "0" says nothing, so fall back to the months form.
 */
function displayAge(birthDate) {
  const years = ageInYears(birthDate);
  if (years === null) return "—";
  if (years >= 1) return String(years);
  return formatAgeLong(birthDate) || "—";
}

function teacherNames(child) {
  const links = Array.isArray(child?.classRoom?.teachers) ? child.classRoom.teachers : [];
  return links
    .map((link) => link?.teacher?.name)
    .filter(Boolean)
    .join(", ");
}

function formatLongDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function lastInitial(lastName) {
  const trimmed = (lastName || "").trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "";
}

function initials(firstName, lastName) {
  const first = (firstName || "").trim().slice(0, 1).toUpperCase();
  const last = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "C";
}
