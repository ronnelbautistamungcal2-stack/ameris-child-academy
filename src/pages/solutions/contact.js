import { useState } from "react";
import SolutionsLayout, { BTN, Icon, NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";

// Ameris Solutions website: Contact Us (client mockup 2026-11-06). The
// message reaches Global admin > Sales & Leads. The mockup has only Subject
// and Message; name and email are added so the team can reply.

const SUBJECTS = ["Pricing and plans", "Request a demo", "Support for my account", "Partnership", "Other"];
const field =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
const label = `block text-sm font-bold ${NAVY}`;

export default function SolutionsContact() {
  const [form, setForm] = useState({ contactName: "", email: "", phone: "", centerName: "", subject: "", message: "", website: "" });
  const [state, setState] = useState({ sending: false, sent: false, error: "" });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setState({ sending: true, sent: false, error: "" });
    try {
      const res = await fetch("/api/v1/solutions/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your message");
      setState({ sending: false, sent: true, error: "" });
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message });
    }
  }

  return (
    <SolutionsLayout title="Contact Us" description="Questions about Ameris Solutions? Send us a message and our team will get back to you.">
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6">
        <h1 className={`font-serif text-4xl font-bold sm:text-5xl ${NAVY}`}>Contact Us</h1>
        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="h-fit rounded-3xl border border-blue-100 bg-blue-50/60 p-6">
            <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Our Information</h2>
            <ul className="mt-4 divide-y divide-blue-100 rounded-2xl bg-white px-5 text-gray-800">
              <li className="flex items-start gap-4 py-4">
                <Icon name="pin" className="mt-0.5 h-6 w-6 text-[#0b2a5b]" />
                <span>
                  {SOLUTIONS_INFO.addressLines.map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </span>
              </li>
              <li className="flex items-center gap-4 py-4">
                <Icon name="phone" className="h-6 w-6 text-[#0b2a5b]" />
                <a href={`tel:${SOLUTIONS_INFO.phone.replace(/\D/g, "")}`} className="hover:underline">
                  {SOLUTIONS_INFO.phone}
                </a>
              </li>
              <li className="flex items-center gap-4 py-4">
                <Icon name="mail" className="h-6 w-6 text-[#0b2a5b]" />
                <a href={`mailto:${SOLUTIONS_INFO.email}`} className="hover:underline">
                  {SOLUTIONS_INFO.email}
                </a>
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">{SOLUTIONS_INFO.hours}</p>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-6">
            <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Send Us a Message</h2>
            {state.sent ? (
              <div role="status" className="mt-4 rounded-2xl bg-green-50 p-5 text-green-900">
                <p className="font-bold">Thank you! Your message has been sent.</p>
                <p className="mt-1 text-sm">Our team will get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl bg-white p-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>
                    Your Name *
                    <input className={field} value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} required autoComplete="name" />
                  </label>
                  <label className={label}>
                    Email *
                    <input className={field} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required autoComplete="email" />
                  </label>
                  <label className={label}>
                    Phone
                    <input className={field} type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" />
                  </label>
                  <label className={label}>
                    Program/Center Name
                    <input className={field} value={form.centerName} onChange={(e) => set({ centerName: e.target.value })} autoComplete="organization" />
                  </label>
                </div>
                <label className={label}>
                  Subject *
                  <select className={field} value={form.subject} onChange={(e) => set({ subject: e.target.value })} required>
                    <option value="">Select a Subject</option>
                    {SUBJECTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Message *
                  <textarea className={`${field} min-h-[120px]`} value={form.message} onChange={(e) => set({ message: e.target.value })} required />
                </label>
                <input type="text" name="website" value={form.website} onChange={(e) => set({ website: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                {state.error ? (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                  </p>
                ) : null}
                <button type="submit" className={`${BTN} px-7 py-3`} disabled={state.sending}>
                  {state.sending ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </SolutionsLayout>
  );
}
