import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import { ExternalLinkIcon } from "@/components/public/icons";

const ICON_COLORS = [
  "bg-sky-100 text-sky-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-violet-100 text-violet-600",
  "bg-rose-100 text-rose-600",
  "bg-teal-100 text-teal-600",
  "bg-orange-100 text-orange-600",
  "bg-indigo-100 text-indigo-600",
];

const RESOURCES = [
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
  { title: "Infant Care", description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.", url: "#" },
];

export default function ResourcesPage() {
  return (
    <PublicLayout title="Resources" description="External resources for parents and providers">
      <HeroSection />
      <ResourcesGrid />
      <HelpSection />
    </PublicLayout>
  );
}

/* ── Hero ─────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
          External Resources
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          Quick access to essential state guidelines, financial assistance programs, and educational
          standards for parents and providers.
        </p>
      </div>
    </section>
  );
}

/* ── Resources Grid ───────────────────────────────────── */

function ResourcesGrid() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {RESOURCES.map((resource, idx) => {
            const colorClass = ICON_COLORS[idx % ICON_COLORS.length];
            return (
              <div
                key={idx}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:shadow-md"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${colorClass}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-extrabold text-gray-900">{resource.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{resource.description}</p>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700"
                >
                  View Website <ExternalLinkIcon />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Help Section ─────────────────────────────────────── */

function HelpSection() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-2xl font-extrabold text-gray-900">Need help with these applications?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-gray-600">
          Our administrative staff is available to guide you through the process of applying for state benefits or
          understanding licensing requirements.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-flex rounded-2xl bg-sky-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-sky-700"
        >
          Schedule a Consultation
        </Link>
      </div>
    </section>
  );
}
