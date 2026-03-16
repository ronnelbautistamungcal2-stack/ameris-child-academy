import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import {
  PlayIcon,
  BabyIcon,
  BlocksIcon,
  BookIcon,
  RocketIcon,
  CameraIcon,
  TruckIcon,
  GraduationIcon,
  ChevronRightIcon,
} from "@/components/public/icons";

const HERO_STATS = [
  { value: "1:4", label: "Infant support ratio" },
  { value: "Daily", label: "Family progress updates" },
  { value: "Safe", label: "Structured care routines" },
];

const PROGRAMS = [
  {
    title: "Infant Care",
    description:
      "Dedicated nurturing for your infant child with a 1:4 caretaker-to-infant focus and development-centered routines.",
    icon: BabyIcon,
    color: "bg-sky-100 text-sky-700",
    meta: "6 weeks to 18 months",
  },
  {
    title: "Toddler Discovery",
    description:
      "Encouraging curiosity through sensory play, early communication, movement, and social interaction.",
    icon: BlocksIcon,
    color: "bg-emerald-100 text-emerald-700",
    meta: "18 months to 3 years",
  },
  {
    title: "Preschool Prep",
    description:
      "Building a stronger foundation for academic readiness with literacy, math, self-direction, and creative arts.",
    icon: BookIcon,
    color: "bg-amber-100 text-amber-700",
    meta: "3 to 5 years",
  },
  {
    title: "Turbokindz",
    description:
      "Character development focused on leadership, cooperation, confidence, and emotional intelligence.",
    icon: RocketIcon,
    color: "bg-blue-100 text-blue-800",
    meta: "Leadership and enrichment",
  },
];

const RESOURCES = [
  { label: "Photo Gallery", icon: CameraIcon, color: "bg-rose-100 text-rose-600" },
  { label: "Pick & Drop", icon: TruckIcon, color: "bg-amber-100 text-amber-600" },
  { label: "Student Learning", icon: GraduationIcon, color: "bg-emerald-100 text-emerald-600" },
  { label: "Daily Reports", icon: BookIcon, color: "bg-blue-100 text-blue-700" },
];

const ENROLLMENT_STEPS = [
  "Book a visit and meet the teaching team.",
  "Choose the right program for your child's stage.",
  "Finish forms, routines, and onboarding details.",
];

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <div className="animate-fade-in flex flex-col items-center">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-200">
              <svg viewBox="0 0 32 32" className="h-9 w-9 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 6c-3 0-5.5 2-6.5 4.5C8.5 8 6 8.5 4.5 11 3 13.5 3.5 16.5 5 18.5L16 28l11-9.5c1.5-2 2-5 .5-7.5S23.5 8 22.5 10.5C21.5 8 19 6 16 6z" />
              </svg>
            </div>
            <div className="absolute -inset-3 animate-ping rounded-3xl border-2 border-sky-200 opacity-30" />
          </div>
          <h2 className="mt-5 text-lg font-extrabold tracking-tight text-gray-900">
            Ameris Child Academy
          </h2>
          <div className="mt-4 flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PublicLayout
      title="Home"
      description="Every Child Deserves a Brighter Beginning - Ameris Child Academy"
    >
      <HeroSection />
      <LearningProgramsSection />
      <ParentResourcesSection />
    </PublicLayout>
  );
}

function HeroSection() {
  const videoRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState("16 / 9");

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play();
    setHasStarted(true);
  };

  const handleLoadedMetadata = (event) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (!videoWidth || !videoHeight) return;
    setVideoAspectRatio(`${videoWidth} / ${videoHeight}`);
  };

  return (
    <section className="relative overflow-hidden pb-10 pt-8 lg:pb-16 lg:pt-14">
      <div className="section-shell">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
              Enrolling now
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Early learning that feels{" "}
              <span className="bg-gradient-to-r from-sky-700 via-cyan-600 to-amber-500 bg-clip-text text-transparent">
                warm, structured, and clear
              </span>{" "}
              for families.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Ameris combines nurturing care, age-appropriate learning, and consistent parent communication so families always know what their child is doing, learning, and needing next.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/programs"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-700 via-cyan-600 to-blue-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_22px_44px_-28px_rgba(2,132,199,0.9)] transition hover:-translate-y-0.5 hover:from-sky-800 hover:to-blue-700"
              >
                Explore programs
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white/85 px-6 py-3 text-sm font-extrabold text-gray-900 transition hover:bg-white"
              >
                Schedule a visit
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {HERO_STATS.map((item) => (
                <div key={item.label} className="glass-surface rounded-[24px] px-5 py-4">
                  <div className="text-2xl font-black tracking-tight text-gray-900">{item.value}</div>
                  <div className="mt-1 text-sm text-gray-600">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[28px] border border-sky-100 bg-white/80 p-5 shadow-[0_28px_60px_-40px_rgba(14,116,144,0.55)]">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700">Enrollment flow</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {ENROLLMENT_STEPS.map((step, index) => (
                  <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-extrabold text-sky-700">Step {index + 1}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-8 hidden h-24 w-24 rounded-full bg-amber-200/60 blur-2xl lg:block" />
            <div className="absolute -right-4 bottom-10 hidden h-28 w-28 rounded-full bg-sky-200/70 blur-2xl lg:block" />
            <div className="glass-surface relative overflow-hidden rounded-[32px] p-4">
              <div
                className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-300 via-cyan-200 to-amber-100 shadow-inner"
                style={{ aspectRatio: videoAspectRatio }}
              >
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-contain"
                  src="/home-video.mp4"
                  playsInline
                  preload="metadata"
                  controls={hasStarted}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setHasStarted(false)}
                />
                {!hasStarted && (
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="absolute inset-0 z-10 grid place-items-center bg-slate-950/20 text-white transition hover:bg-slate-950/30"
                    aria-label="Play video"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-sky-600 shadow-lg transition hover:scale-105">
                      <PlayIcon className="ml-1 h-10 w-10" />
                    </div>
                  </button>
                )}
              </div>
              <div className="grid gap-3 px-2 pb-2 pt-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">For families</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">
                    Daily reports, learning snapshots, and easier communication with staff.
                  </div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-700">For children</div>
                  <div className="mt-2 text-sm font-semibold text-amber-900">
                    Nurturing routines, structured play, and stronger readiness for the next stage.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LearningProgramsSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Our Learning Programs</h2>
            <p className="section-copy mt-2 max-w-2xl">
              Tailored curriculum packages for every stage of development, from infancy through character building.
            </p>
          </div>
          <Link
            href="/programs"
            className="hidden items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700 sm:flex"
          >
            View all programs <ChevronRightIcon />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMS.map((program) => {
            const Icon = program.icon;
            return (
              <div
                key={program.title}
                className="glass-surface rounded-[28px] p-6 transition duration-200 hover:-translate-y-1"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${program.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-gray-500">{program.meta}</div>
                <h3 className="mt-4 text-base font-extrabold text-gray-900">{program.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{program.description}</p>
                <Link
                  href="/programs"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700"
                >
                  Learn More <ChevronRightIcon />
                </Link>
              </div>
            );
          })}
        </div>

        <Link
          href="/programs"
          className="mt-6 flex items-center justify-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700 sm:hidden"
        >
          View all programs <ChevronRightIcon />
        </Link>
      </div>
    </section>
  );
}

function ParentResourcesSection() {
  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-r from-white/85 via-sky-50/90 to-emerald-50/85 p-8 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.28)] lg:p-12">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-700">Parent resources</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-900">Everything families need in one place</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
                Everything parents need to stay engaged with their child&apos;s learning journey, all in one convenient location.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {RESOURCES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5"
                    >
                      <div className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${item.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800"
                >
                  Open family portal
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="aspect-square rounded-[30px] bg-gradient-to-br from-emerald-100 via-white to-sky-100 p-8">
                <svg viewBox="0 0 200 200" className="h-full w-full p-8 text-emerald-600" aria-hidden="true">
                  <ellipse cx="100" cy="150" rx="70" ry="20" fill="currentColor" opacity="0.15" />
                  <path d="M80 140 C80 80, 60 60, 90 40 Q100 30 110 40 C140 60 120 80 120 140Z" fill="currentColor" opacity="0.4" />
                  <path d="M90 140 C90 100, 100 80, 100 50 Q105 40 110 50 C110 80 120 100 120 140Z" fill="currentColor" opacity="0.6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
