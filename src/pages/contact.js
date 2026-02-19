import { useState } from "react";
import PublicLayout from "@/components/public/PublicLayout";
import { PhoneIcon, MailIcon, MapPinIcon } from "@/components/public/icons";

export default function ContactPage() {
  return (
    <PublicLayout title="Contact Us" description="Get in touch with Ameris Child Academy">
      <HeroSection />
      <ContactSection />
    </PublicLayout>
  );
}

/* ── Hero ─────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
          Get in Touch
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          Have questions about our programs or enrollment? We&apos;re here to help. Reach out to the
          Ameris team through any of the channels below.
        </p>
      </div>
    </section>
  );
}

/* ── Contact Form + Sidebar ───────────────────────────── */

function ContactSection() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
    }, 1000);
  }

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
            <h2 className="text-xl font-extrabold text-gray-900">Send us a message</h2>

            {submitted ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="text-base font-semibold text-emerald-800">
                  Thank you for reaching out!
                </p>
                <p className="mt-2 text-sm text-emerald-700">
                  We&apos;ll get back to you within 1-2 business days.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Full Name
                    </span>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="John Doe"
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Email Address
                    </span>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="john@example.com"
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Subject
                  </span>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="enrollment">Enrollment</option>
                    <option value="programs">Programs</option>
                    <option value="billing">Billing</option>
                    <option value="careers">Careers</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Message
                  </span>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="How can we help you?"
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-sky-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <ContactItem
              icon={PhoneIcon}
              title="Phone Number"
              lines={["(555) 123-4567", "Mon - Fri, 9am - 5pm"]}
            />
            <ContactItem
              icon={MailIcon}
              title="Email Address"
              lines={["info@amerischildcare.com"]}
            />
            <ContactItem
              icon={MapPinIcon}
              title="Physical Address"
              lines={["123 Education Lane", "Brighter City, ST 12345"]}
            />

            {/* Map placeholder */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
              <div className="flex aspect-[4/3] items-center justify-center">
                <div className="text-center text-gray-400">
                  <MapPinIcon className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-xs">Map view</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactItem({ icon: Icon, title, lines }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">{title}</h3>
          {lines.map((line, idx) => (
            <p key={idx} className="text-sm text-gray-600">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
