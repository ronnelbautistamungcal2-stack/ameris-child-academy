import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import { AwardIcon, BuildingIcon, UsersIcon } from "@/components/public/icons";

const STATS = [
  { number: "10+", label: "Years of Experience", icon: AwardIcon },
  { number: "15+", label: "Certified Educators", icon: UsersIcon },
  { number: "3", label: "Center Locations", icon: BuildingIcon },
];

const ADMIN_TEAM = [
  { name: "Dr. Sarah Jenkins", title: "PhD in Educational Leadership with 15 years of early childhood management experience" },
  { name: "Dr. Sarah Jenkins", title: "PhD in Education with 12 years of center management experience" },
  { name: "Dr. Sarah Jenkins", title: "PhD in Education with 10 years of childcare management experience" },
  { name: "Dr. Sarah Jenkins", title: "PhD in Education with 8 years of management experience" },
];

const COACHES = [
  { name: "Dr. Sarah Jenkins", title: "PhD in Education with 15 years of center administration" },
  { name: "Dr. Sarah Jenkins", title: "PhD in Education with 10 years of similar experience" },
  { name: "Dr. Sarah Jenkins", title: "Master's Educator with 15 years of similar training experience" },
  { name: "Dr. Sarah Jenkins", title: "PhD in Education with 12 years of childcare experience" },
];

export default function AboutPage() {
  return (
    <PublicLayout title="About Us" description="Learn about Ameris Childcare Management">
      <AboutHero />
      <MissionQuote />
      <StatsSection />
      <TeamSection title="Administrative Leadership" members={ADMIN_TEAM} />
      <TeamSection title="Education Coaches" members={COACHES} />
      <JoinCTA />
    </PublicLayout>
  );
}

/* ── About Hero ───────────────────────────────────────── */

function AboutHero() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
              About Ameris Childcare
            </h1>
            <p className="mt-4 text-base text-gray-600">
              Since our founding in 2015, Ameris Childcare has been dedicated to providing exceptional
              early childhood education and care across multiple centers. We believe that the early years
              are the most critical for cognitive and social development.
            </p>
            <p className="mt-3 text-base text-gray-600">
              Our curriculum is designed to foster curiosity, creativity, and confidence in every child,
              preparing them for lifelong learning success.
            </p>
          </div>
          <div className="aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 to-sky-200">
            <div className="flex h-full items-center justify-center">
              <svg viewBox="0 0 200 120" className="h-full w-full p-8 text-sky-400" aria-hidden="true">
                <rect x="20" y="30" width="60" height="60" rx="8" fill="currentColor" opacity="0.3" />
                <rect x="50" y="20" width="100" height="70" rx="8" fill="currentColor" opacity="0.4" />
                <rect x="30" y="50" width="40" height="30" rx="4" fill="white" opacity="0.5" />
                <rect x="80" y="40" width="50" height="35" rx="4" fill="white" opacity="0.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Mission Quote ────────────────────────────────────── */

function MissionQuote() {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-2xl border-l-4 border-sky-400 bg-sky-50 p-6 lg:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Our Mission</p>
          <p className="mt-3 text-lg font-semibold italic text-gray-800">
            &ldquo;To empower the next generation by providing holistic education that nurtures
            cognitive, physical, and social-emotional growth in a community-centered environment.&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Stats ────────────────────────────────────────────── */

function StatsSection() {
  return (
    <section className="bg-white pb-16">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-6 text-center"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-3 text-3xl font-extrabold text-gray-900">{stat.number}</div>
                <div className="mt-1 text-sm text-gray-600">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Team Section ─────────────────────────────────────── */

function TeamSection({ title, members }) {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        {title === "Administrative Leadership" && (
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">Meet Our Exceptional Team</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-600">
              Our dedicated staff brings decades of combined experience in early childhood education
              and center administration.
            </p>
          </div>
        )}

        <h3 className="mb-8 text-xl font-extrabold text-gray-900">{title}</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member, idx) => {
            const initials = member.name
              .split(" ")
              .filter(Boolean)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                <div className="mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 to-sky-300">
                  <div className="flex h-full items-center justify-center">
                    <span className="text-4xl font-extrabold text-white">{initials}</span>
                  </div>
                </div>
                <h4 className="mt-4 text-base font-extrabold text-gray-900">{member.name}</h4>
                <p className="mt-1 text-sm text-gray-600">{member.title}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Join CTA ─────────────────────────────────────────── */

function JoinCTA() {
  return (
    <section className="bg-gradient-to-r from-sky-600 to-sky-700 py-16">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-2xl font-extrabold text-white lg:text-3xl">Join the Ameris Family</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-sky-100">
          Interested in working with us or enrolling your child? We&apos;d love to help them grow
          into their brightest future.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/careers"
            className="rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-sky-700 transition hover:bg-sky-50"
          >
            Apply Now
          </Link>
          <Link
            href="/contact"
            className="rounded-2xl border border-white/30 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
