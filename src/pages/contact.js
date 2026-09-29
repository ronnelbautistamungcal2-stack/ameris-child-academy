import { useState } from "react";
import PublicLayout from "@/components/public/PublicLayout";
import { MapPinIcon, PhoneIcon } from "@/components/public/icons";
import { PUBLIC_CONTACT } from "@/components/public/siteData";

// Keys must match SUBJECT_LABELS in /api/v1/public/contact.
const SUBJECT_OPTIONS = [
  { value: "enrollment", label: "Enrollment" },
  { value: "programs", label: "Programs & Daily Routine" },
  { value: "family_support", label: "Family Support" },
  { value: "billing", label: "Billing" },
  { value: "careers", label: "Careers" },
  { value: "general", label: "General Question" },
];

const EMPTY_FORM = { fullName: "", email: "", phone: "", subject: "", message: "" };

const INPUT_CLASS =
  "mt-1.5 block w-full rounded-[6px] border border-[#c9d3e0] bg-white px-3 py-2.5 font-sans text-[14px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#2566b8] focus:ring-2 focus:ring-[#2566b8]/20";

export default function ContactPage() {
  return (
    <PublicLayout
      title="Contact Us"
      description="Contact Ameris Academy to ask enrollment questions or request a visit."
    >
      <section className="relative overflow-hidden bg-white pb-28 pt-28 font-serif sm:pb-36 sm:pt-32">
        <TopWave />
        <Leaf className="absolute bottom-10 left-2 hidden h-28 w-28 sm:block lg:left-8" />
        <Leaf className="absolute bottom-10 right-2 hidden h-28 w-28 -scale-x-100 sm:block lg:right-8" />

        <div className="relative mx-auto grid w-full max-w-[1120px] gap-10 px-5 lg:grid-cols-[0.44fr_0.56fr] lg:gap-12 lg:px-8">
          <div>
            <h1 className="text-center text-[44px] font-bold leading-tight text-[#133a7c] sm:text-[60px]">
              Contact Us
            </h1>
            <HeartDivider />
            <ContactDetails />
          </div>

          <ContactForm />
        </div>
      </section>
    </PublicLayout>
  );
}

function ContactDetails() {
  return (
    <div className="mt-8 rounded-[14px] bg-[#e8f3fd] px-6 py-4 sm:px-8">
      <DetailRow icon={<PhoneIcon className="h-8 w-8" />} tone="bg-[#78ad5c]" label="Phone">
        <a href={PUBLIC_CONTACT.phoneHref} className="hover:underline">
          {PUBLIC_CONTACT.phoneDisplay}
        </a>
      </DetailRow>
      <DetailRow icon={<MapPinIcon className="h-8 w-8" />} tone="bg-[#e3606f]" label="Address">
        {PUBLIC_CONTACT.addressLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </DetailRow>
      <DetailRow icon={<ClockIcon className="h-9 w-9" />} tone="bg-[#4a97d8]" label="Hours" last>
        <span className="block">{PUBLIC_CONTACT.hoursDays}</span>
        <span className="block">{PUBLIC_CONTACT.hoursTime}</span>
      </DetailRow>
    </div>
  );
}

function DetailRow({ icon, tone, label, children, last = false }) {
  return (
    <div className="flex items-center gap-6 py-4">
      <div
        className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-white ${tone}`}
      >
        {icon}
      </div>
      <div className={`flex-1 pb-4 ${last ? "" : "border-b border-[#b9d6ee]"}`}>
        <h2 className="text-[21px] font-bold text-[#133a7c]">{label}</h2>
        <div className="mt-0.5 text-[19px] leading-snug text-[#1f4b8f]">{children}</div>
      </div>
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/v1/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "We couldn't send your message. Please try again.");
      }
      setForm(EMPTY_FORM);
      setStatus("sent");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  return (
    <div className="rounded-[14px] bg-[#fbf6ef] px-6 py-8 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] sm:px-9">
      <h2 className="text-[32px] font-bold leading-tight text-[#133a7c] sm:text-[36px]">
        Send Us a Message
      </h2>
      <p className="mt-2 text-[15px] text-[#1f4b8f]">
        Fill out the form below and we&apos;ll get back to you as soon as possible.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Your Name" required>
          <input
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={form.fullName}
            onChange={update("fullName")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Your Email" required>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={update("email")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Phone Number">
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={update("phone")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Subject" required>
          <select
            required
            value={form.subject}
            onChange={update("subject")}
            className={`${INPUT_CLASS} ${form.subject ? "" : "text-slate-500"}`}
          >
            <option value="" disabled>
              Select a topic
            </option>
            {SUBJECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your Message" required className="sm:col-span-2">
          <textarea
            required
            minLength={20}
            rows={4}
            placeholder="Type your message here..."
            value={form.message}
            onChange={update("message")}
            className={`${INPUT_CLASS} resize-y`}
          />
        </Field>

        <div className="sm:col-span-2">
          {error && (
            <p role="alert" className="mb-3 rounded-[6px] bg-red-50 px-3 py-2 font-sans text-sm text-red-700">
              {error}
            </p>
          )}
          {status === "sent" && (
            <p role="status" className="mb-3 rounded-[6px] bg-green-50 px-3 py-2 font-sans text-sm text-green-800">
              Thank you! Your message has been sent. We&apos;ll be in touch soon.
            </p>
          )}
          <button
            type="submit"
            disabled={status === "sending"}
            className="flex w-full items-center justify-center gap-3 rounded-[8px] bg-[#133a7c] px-6 py-3 text-[18px] font-semibold text-white shadow-[0_10px_22px_-14px_rgba(19,58,124,0.9)] transition hover:bg-[#0f2f66] disabled:opacity-70"
          >
            <SendIcon className="h-6 w-6" />
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
          <p className="mt-3 text-center text-[13px] text-[#1f4b8f]">
            We typically respond during our business hours (M&ndash;F, {PUBLIC_CONTACT.hoursTime}).
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required = false, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[15px] font-bold text-[#133a7c]">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function HeartDivider() {
  return (
    <div className="mt-2 flex items-center gap-3" aria-hidden="true">
      <span className="h-[2px] flex-1 bg-[#a9d4f2]" />
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#f07a93]" fill="currentColor">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6.3.6.7.6 1 0 .7-1.4 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z" />
      </svg>
      <span className="h-[2px] flex-1 bg-[#a9d4f2]" />
    </div>
  );
}

function TopWave() {
  return (
    <svg
      viewBox="0 0 1440 140"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-0 h-[110px] w-full sm:h-[130px]"
      aria-hidden="true"
    >
      <path d="M0,0 H1440 V70 C1180,120 900,70 620,92 C380,112 180,120 0,88 Z" fill="#f2f8fe" />
      <path
        d="M0,88 C180,120 380,112 620,92 C900,70 1180,120 1440,70 V84 C1180,134 900,86 620,106 C380,126 180,132 0,102 Z"
        fill="#bfe0f7"
      />
    </svg>
  );
}

function Leaf({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={`pointer-events-none ${className}`} aria-hidden="true">
      <path d="M50 98 C50 70 48 45 40 20" stroke="#8fae6e" strokeWidth="2.5" fill="none" />
      <path d="M44 38 C30 36 18 26 16 10 C32 12 42 22 44 38 Z" fill="#a9c58a" />
      <path d="M47 58 C60 50 74 50 86 58 C74 68 58 68 47 58 Z" fill="#9dbd7c" />
      <path d="M49 78 C36 72 22 74 12 82 C24 90 40 88 49 78 Z" fill="#b3cd95" />
    </svg>
  );
}

function ClockIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}

function SendIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.7 2.3a1 1 0 0 0-1.05-.23l-18 7a1 1 0 0 0 .06 1.89l7.2 2.13 2.13 7.2a1 1 0 0 0 1.89.06l7-18a1 1 0 0 0-.23-1.05ZM10.6 12.2 6.2 10.9 17.4 6.6Zm2.3 5.6-1.3-4.4 5.6-5.6Z" />
    </svg>
  );
}
