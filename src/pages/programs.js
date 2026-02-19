import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import {
  BabyIcon,
  BlocksIcon,
  BookIcon,
  RocketIcon,
  DownloadIcon,
  PlayIcon,
  CheckIcon,
} from "@/components/public/icons";

/* ── Data ─────────────────────────────────────────────── */

const CURRICULUM_PACKAGES = [
  {
    title: "Infants",
    description: "Dedicated nurturing for your infant child with a 1:4 caretaker/infant focus.",
    icon: BabyIcon,
    color: "bg-sky-100 text-sky-700",
  },
  {
    title: "Toddlers",
    description: "Dedicated nurturing for your toddler child with fun, imaginative focus.",
    icon: BlocksIcon,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "2 Years",
    description: "Dedicated nurturing for your toddler child with early social interaction focus.",
    icon: BookIcon,
    color: "bg-amber-100 text-amber-700",
  },
  {
    title: "Preschool",
    description: "Dedicated nurturing for your toddler child with a 1:4 caretaker/infant focus.",
    icon: RocketIcon,
    color: "bg-violet-100 text-violet-700",
  },
];

const DAYCARE_SETUPS = [
  {
    tag: "UP TO 6 HIGH QUALITY",
    title: "Home Daycare Setup",
    description:
      "Start or enhance your home-based learning center with our turnkey curriculum and training package.",
    cta: "Inquire Now",
  },
  {
    tag: "UNLIMITED QUALITY",
    title: "Center Daycare Setup",
    description:
      "Our comprehensive center suite provides the blueprint for establishing or improving your childcare facility.",
    cta: "Inquire Now",
  },
];

const VALUES = [
  {
    age: "Age 0-2",
    title: "Empathy & Comfort",
    items: [
      "Responsive interaction Skills",
      "Responsive interaction Skills",
      "Responsive interaction Skills",
    ],
  },
  {
    age: "Age 2-5",
    title: "Respect & Cooperation",
    items: [
      "Responsive interaction Skills",
      "Responsive interaction Skills",
      "Responsive interaction Skills",
    ],
  },
  {
    age: "Age 5-7",
    title: "Leadership & Integrity",
    items: [
      "Responsive interaction Skills",
      "Responsive interaction Skills",
      "Responsive interaction Skills",
    ],
  },
];

const SPECIALIZED_CLASSES = Array.from({ length: 6 }, (_, i) => ({
  title: "Our Learning Programs",
  description:
    "Tailored curriculum packages for every stage of development, from infancy through character building.",
}));

/* ── Page ─────────────────────────────────────────────── */

export default function ProgramsPage() {
  return (
    <PublicLayout title="Programs & Curriculum" description="Explore our learning programs and curriculum packages">
      <CurriculumPackagesSection />
      <DaycareSetupSection />
      <LearningValuesSection />
      <SpecializedClassesSection />
    </PublicLayout>
  );
}

/* ── Curriculum Packages ──────────────────────────────── */

function CurriculumPackagesSection() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
            Curriculum Packages
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
            Foundational learning packages designed for every milestone.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CURRICULUM_PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <div
                key={pkg.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:shadow-md"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${pkg.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-gray-900">{pkg.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{pkg.description}</p>
                <a
                  href="#"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700"
                >
                  Download PDF <DownloadIcon className="h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Daycare Setup ────────────────────────────────────── */

function DaycareSetupSection() {
  return (
    <section className="border-y-4 border-dashed border-sky-200 bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Our Learning Programs</h2>
          <p className="mt-2 max-w-xl text-sm text-gray-600">
            Tailored curriculum packages for every stage of development, from infancy through character building.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {DAYCARE_SETUPS.map((setup, idx) => (
            <div key={idx} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="aspect-video bg-gradient-to-br from-emerald-100 to-emerald-200">
                <div className="flex h-full items-center justify-center">
                  <svg viewBox="0 0 200 120" className="h-3/4 w-3/4 text-emerald-500" aria-hidden="true">
                    <ellipse cx="100" cy="100" rx="60" ry="15" fill="currentColor" opacity="0.15" />
                    <path d="M70 95 C70 50, 55 40, 85 25 Q100 15 115 25 C145 40 130 50 130 95Z" fill="currentColor" opacity="0.4" />
                    <path d="M85 95 C85 65, 95 50, 100 30 Q105 20 110 30 C105 50 115 65 115 95Z" fill="currentColor" opacity="0.6" />
                  </svg>
                </div>
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-600">{setup.tag}</span>
                <h3 className="mt-2 text-lg font-extrabold text-gray-900">{setup.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{setup.description}</p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700"
                >
                  {setup.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Learning Values ──────────────────────────────────── */

function LearningValuesSection() {
  return (
    <section className="border-b-4 border-dashed border-sky-200 bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Our Learning Programs</h2>
          <p className="mt-2 max-w-xl text-sm text-gray-600">
            Tailored curriculum packages for every stage of development, from infancy through character building.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((group) => (
            <div key={group.title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                {group.age}
              </span>
              <h3 className="mt-3 text-lg font-extrabold text-gray-900">{group.title}</h3>
              <ul className="mt-4 space-y-3">
                {group.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckIcon className="h-4 w-4 flex-shrink-0 text-sky-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Specialized Classes ──────────────────────────────── */

function SpecializedClassesSection() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Our Specialized Classes</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
            Enrichment programs designed to develop specific skills and interests.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SPECIALIZED_CLASSES.map((cls, idx) => (
            <div key={idx} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="relative aspect-video bg-gradient-to-br from-emerald-100 to-emerald-200">
                <div className="flex h-full items-center justify-center">
                  <svg viewBox="0 0 200 120" className="h-3/4 w-3/4 text-emerald-500" aria-hidden="true">
                    <ellipse cx="100" cy="100" rx="60" ry="15" fill="currentColor" opacity="0.15" />
                    <path d="M70 95 C70 50, 55 40, 85 25 Q100 15 115 25 C145 40 130 50 130 95Z" fill="currentColor" opacity="0.4" />
                    <path d="M85 95 C85 65, 95 50, 100 30 Q105 20 110 30 C105 50 115 65 115 95Z" fill="currentColor" opacity="0.6" />
                  </svg>
                </div>
                <button
                  type="button"
                  className="absolute inset-0 grid place-items-center text-emerald-700 transition hover:text-emerald-900"
                  aria-label="Play video"
                >
                  <PlayIcon className="h-12 w-12" />
                </button>
              </div>
              <div className="p-5">
                <h3 className="text-base font-extrabold text-gray-900">{cls.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{cls.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
