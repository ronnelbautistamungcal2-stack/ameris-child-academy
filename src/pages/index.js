import { useEffect } from "react";
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

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="grid h-screen place-items-center bg-gray-50 text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  if (session) {
    return (
      <div className="grid h-screen place-items-center bg-gray-50 text-sm text-gray-500">
        Redirecting...
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

/* ── Hero ─────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 to-white">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="text-center">
          <span className="inline-block rounded-full bg-sky-100 px-4 py-1.5 text-xs font-semibold text-sky-700">
            Enrolling for Fall semester
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900 lg:text-5xl">
            Every Child Deserves a{" "}
            <span className="text-sky-600">Brighter Beginning</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">
            Welcome to Ameris, a premier early learning center providing a safe, nurturing, and stimulating
            environment designed to help your child thrive.
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-3xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 to-sky-400">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-32 rounded-full bg-sky-300/40" />
            </div>
            <button
              type="button"
              className="absolute inset-0 grid place-items-center text-sky-700 transition hover:text-sky-900"
              aria-label="Play video"
            >
              <PlayIcon className="h-16 w-16" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Our Learning Programs ────────────────────────────── */

const PROGRAMS = [
  {
    title: "Infant Care",
    description:
      "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus and developmental activities.",
    icon: BabyIcon,
    color: "bg-sky-100 text-sky-700",
  },
  {
    title: "Toddler Discovery",
    description:
      "Encouraging curiosity through sensory play, early communication, and social interaction.",
    icon: BlocksIcon,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "Preschool Prep",
    description:
      "Building a strong foundation for academic readiness with literacy, math, and creative arts.",
    icon: BookIcon,
    color: "bg-amber-100 text-amber-700",
  },
  {
    title: "Turbokindz",
    description:
      "Character development focusing on leadership, cooperation, and emotional intelligence.",
    icon: RocketIcon,
    color: "bg-violet-100 text-violet-700",
  },
];

function LearningProgramsSection() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Our Learning Programs</h2>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
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
                className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:shadow-md"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${program.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-gray-900">{program.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{program.description}</p>
                <Link
                  href="/programs"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700"
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

/* ── Parent Resources ─────────────────────────────────── */

const RESOURCES = [
  { label: "Photo Gallery", icon: CameraIcon, color: "bg-rose-100 text-rose-600" },
  { label: "Pick & Drop", icon: TruckIcon, color: "bg-amber-100 text-amber-600" },
  { label: "Student Learning", icon: GraduationIcon, color: "bg-emerald-100 text-emerald-600" },
  { label: "Daily Reports", icon: BookIcon, color: "bg-violet-100 text-violet-600" },
];

function ParentResourcesSection() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 p-8 lg:p-12">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Parent Resources</h2>
              <p className="mt-2 max-w-md text-sm text-gray-600">
                Everything parents need to stay engaged with their child&apos;s learning journey, all in one
                convenient location.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {RESOURCES.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:shadow-sm"
                    >
                      <div className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${item.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200">
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
