import { useState } from "react";
import PublicLayout from "@/components/public/PublicLayout";
import { MailIcon, MapPinIcon, PhoneIcon } from "@/components/public/icons";
import { apiJson } from "@/lib/api";
import { PUBLIC_CONTACT } from "@/components/public/siteData";

const INITIAL_FORM = {
  fullName: "",
  email: "",
  phone: "",
  childAgeRange: "",
  startTimeline: "",
  subject: "",
  message: "",
};

const SUBJECT_OPTIONS = [
  { value: "enrollment", label: "Enrollment" },
  { value: "programs", label: "Programs & Daily Routine" },
  { value: "family_support", label: "Family Support" },
  { value: "billing", label: "Billing" },
  { value: "careers", label: "Careers" },
  { value: "general", label: "General Question" },
];

const TIMELINE_OPTIONS = [
  "As soon as possible",
  "Within 30 days",
  "Within 1 to 3 months",
  "Planning ahead for later this year",
];

const EXPECTATIONS = [
  "Your preferred start timeline or visit window",
  "Your child's age or age range",
  "Questions about routines, support needs, or communication",
];

export default function ContactPage() {
  return (
    <PublicLayout title="Contact" description="Contact Ameris Child Academy to ask enrollment questions or request a visit.">
      <HeroSection />
      <ContactSection />
    </PublicLayout>
  );
}

function HeroSection() {
  return (
    <section className="py-16 lg:py-20">
      <div className="section-shell">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
              Contact the team
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
              Ask the right questions before you enroll.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
              Use the form below to request a visit, ask about placement, or get clarity on routines, communication, and family support.
            </p>
          </div>

          <div className="glass-surface rounded-[30px] p-6">
            <div className="rounded-[28px] bg-gradient-to-br from-white via-sky-50 to-amber-50 p-6">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">Helpful to include</div>
              <ul className="mt-5 space-y-3">
                {EXPECTATIONS.map((item) => (
                  <li key={item} className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await apiJson("/api/v1/public/contact", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setSubmitted(true);
      setFormData(INITIAL_FORM);
    } catch (err) {
      setError(err.message || "We couldn't submit your request right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="py-16">
      <div className="section-shell">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="glass-surface rounded-[30px] p-6 lg:p-8">
            <h2 className="text-2xl font-black tracking-tight text-gray-900">Send a message</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Submissions go into the app so the team can review and follow up from the same system they already use.
            </p>

            {submitted ? (
              <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-base font-extrabold text-emerald-800">Your request has been sent.</p>
                <p className="mt-2 text-sm leading-6 text-emerald-700">
                  The team has your details and can follow up through the admin system. You can also call or email directly if the question is urgent.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-4 inline-flex rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-800"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField
                    label="Full Name"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                  />
                  <FormField
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FormField
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                  />
                  <FormField
                    label="Child Age Range"
                    name="childAgeRange"
                    value={formData.childAgeRange}
                    onChange={handleChange}
                    placeholder="Example: 18 months"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preferred Timeline</span>
                    <select
                      name="startTimeline"
                      value={formData.startTimeline}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    >
                      <option value="">Select a timeline</option>
                      {TIMELINE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Topic</span>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    >
                      <option value="">Select a topic</option>
                      {SUBJECT_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</span>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    maxLength={2000}
                    placeholder="Tell us what you're looking for, what age group you need, and any questions you'd like answered before a visit."
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                  />
                </label>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" aria-live="polite">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>

          <div className="space-y-5">
            <ContactCard
              icon={PhoneIcon}
              color="bg-sky-100 text-sky-700"
              title="Call"
              primary={<a href={PUBLIC_CONTACT.phoneHref} className="font-semibold text-gray-900 hover:text-sky-700">{PUBLIC_CONTACT.phoneDisplay}</a>}
              secondary={PUBLIC_CONTACT.visitHours}
            />
            <ContactCard
              icon={MailIcon}
              color="bg-emerald-100 text-emerald-700"
              title="Email"
              primary={<a href={`mailto:${PUBLIC_CONTACT.email}`} className="font-semibold text-gray-900 hover:text-sky-700">{PUBLIC_CONTACT.email}</a>}
              secondary="Best for visit requests, enrollment questions, and follow-up details."
            />
            <ContactCard
              icon={MapPinIcon}
              color="bg-amber-100 text-amber-700"
              title="Visit"
              primary={<span className="font-semibold text-gray-900">{PUBLIC_CONTACT.addressLines[0]}</span>}
              secondary={PUBLIC_CONTACT.addressLines[1]}
            />

            <div className="glass-surface rounded-[28px] p-5">
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-700">Before you visit</div>
              <h3 className="mt-3 text-lg font-extrabold text-gray-900">Bring the questions that matter later.</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                <li>Ask how routines are shared with families each day.</li>
                <li>Ask what communication looks like when extra support is needed.</li>
                <li>Ask how learning goals and progress are documented over time.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormField({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
      />
    </label>
  );
}

function ContactCard({ icon: Icon, color, title, primary, secondary }) {
  return (
    <div className="glass-surface rounded-[28px] p-5">
      <div className="flex items-start gap-3">
        <div className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">{title}</h3>
          <div className="mt-1 text-sm text-gray-600">{primary}</div>
          <p className="mt-1 text-sm text-gray-600">{secondary}</p>
        </div>
      </div>
    </div>
  );
}
