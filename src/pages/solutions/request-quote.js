import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SolutionsLayout, { BTN, Icon, NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";

// Ameris Solutions website: Request a Quote (client mockup 2026-11-06). The
// request becomes a New Lead in Global admin > Sales & Leads; the Ameris team
// prices it there and sends the quote.

const ADD_ONS = [
  { key: "STEPS_OF_PROGRESSION", title: "Steps of Progression", text: "Track child development and milestones with easy-to-use assessment tools and progress reports." },
  { key: "TEACHER_TRAINING", title: "Teacher Training", text: "Provide ongoing training, resources, and professional development for your staff." },
  { key: "STAFF_MANAGEMENT", title: "Staff Management", text: "Simplify scheduling, time tracking, evaluations, and staff records." },
];
const field =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
const label = `block text-sm font-bold ${NAVY}`;

export default function SolutionsRequestQuote() {
  const router = useRouter();
  const [options, setOptions] = useState({ ageGroups: [], homeDaycarePrograms: [], bestTimes: [] });
  const [form, setForm] = useState({
    centerName: "",
    contactName: "",
    email: "",
    phone: "",
    bestTime: "",
    programType: "",
    about: "",
    locations: "",
    children: "",
    addOns: [],
    classrooms: {},
    homeDaycareProgram: "",
    curriculumType: "",
    website: "",
  });
  const [state, setState] = useState({ sending: false, sent: false, error: "" });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleAddOn = (key) => set({ addOns: form.addOns.includes(key) ? form.addOns.filter((k) => k !== key) : [...form.addOns, key] });
  const curriculum = form.addOns.includes("CURRICULUM");

  useEffect(() => {
    fetch("/api/v1/solutions/options")
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (router.query.demo) set({ about: "We would like a demo of Ameris Solutions." });
    const fromCard = { "Steps of Progression": "STEPS_OF_PROGRESSION", "Teacher Training": "TEACHER_TRAINING", "Staff Management": "STAFF_MANAGEMENT", Curriculum: "CURRICULUM" }[router.query.addOn];
    if (fromCard) set({ addOns: [fromCard] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.demo, router.query.addOn]);

  async function submit(e) {
    e.preventDefault();
    if (curriculum && !form.curriculumType) {
      setState({ sending: false, sent: false, error: "Select a curriculum type" });
      return;
    }
    setState({ sending: true, sent: false, error: "" });
    try {
      const body = {
        centerName: form.centerName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        bestTime: form.bestTime,
        about: form.about,
        locations: form.locations,
        addOns: form.addOns,
        website: form.website,
        pricingSelection: {
          children: form.children,
          programType: form.programType === "HOME_DAYCARE" ? "HOME_DAYCARE" : "CENTER",
          // Curriculum > Categories > Types (client sheet 10-29 (8), row 9).
          curriculumType: form.curriculumType || null,
          classrooms: curriculum && form.programType !== "HOME_DAYCARE" ? form.classrooms : {},
          homeDaycareProgram: curriculum && form.programType === "HOME_DAYCARE" ? form.homeDaycareProgram : null,
        },
      };
      if (!form.programType) throw new Error("Select the type of program");
      const res = await fetch("/api/v1/solutions/quote-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your request");
      setState({ sending: false, sent: true, error: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message });
    }
  }

  return (
    <SolutionsLayout title="Request a Quote" description="Tell us about your childcare program and we'll recommend the right plan." hideQuoteButton>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-2 sm:px-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <h1 className={`font-serif text-4xl font-bold sm:text-5xl ${NAVY}`}>Request a Quote</h1>
          <p className="mt-3 max-w-xl text-lg text-gray-700">
            Every childcare program is unique. Tell us a little about your program so we can recommend the right plan with the features and support you
            need.
          </p>
        </div>
        <div className="relative hidden aspect-[16/9] overflow-hidden rounded-3xl lg:block">
          <Image src="/solutions/cheerful-early-learning-workspace-1.jpg" alt="" fill sizes="440px" className="object-cover" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[3fr_1fr]">
        {state.sent ? (
          <div role="status" className="rounded-3xl border border-green-200 bg-green-50 p-8 text-green-900">
            <h2 className="font-serif text-2xl font-bold">Thank you! We received your request.</h2>
            <p className="mt-2">Our team will review your program details and be in touch soon with your personalized quote.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="space-y-4 rounded-3xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
              <label className={label}>
                Program/Center Name *
                <input className={field} value={form.centerName} onChange={(e) => set({ centerName: e.target.value })} required autoComplete="organization" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Your Name *
                  <input className={field} value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} required autoComplete="name" />
                </label>
                <label className={label}>
                  Email Address *
                  <input className={field} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required autoComplete="email" />
                </label>
                <label className={label}>
                  Phone Number
                  <input className={field} type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" />
                </label>
                <label className={label}>
                  Best Time to Contact You
                  <select className={field} value={form.bestTime} onChange={(e) => set({ bestTime: e.target.value })}>
                    <option value="">Select an option</option>
                    {options.bestTimes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={`${label} max-w-xs`}>
                Type of Program *
                <select className={field} value={form.programType} onChange={(e) => set({ programType: e.target.value })} required>
                  <option value="">Select a program type</option>
                  <option value="CENTER">Childcare Center / Preschool</option>
                  <option value="HOME_DAYCARE">Home Daycare</option>
                </select>
              </label>
              <label className={label}>
                Tell us a little about your program
                <textarea
                  className={`${field} min-h-[90px]`}
                  value={form.about}
                  onChange={(e) => set({ about: e.target.value })}
                  placeholder="Optional: share any additional information about your program or specific needs."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Number of locations/centers *
                  <input className={field} type="number" min="1" value={form.locations} onChange={(e) => set({ locations: e.target.value })} required />
                </label>
                <label className={label}>
                  Total number of children *
                  <input className={field} type="number" min="1" value={form.children} onChange={(e) => set({ children: e.target.value })} required />
                </label>
              </div>
            </div>

            <fieldset className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
              <legend className={`px-1 font-serif text-2xl font-bold ${NAVY}`}>Add-Ons</legend>
              <p className="text-sm text-gray-700">Select any additional tools you are interested in. (The Base Program is included with every plan.)</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ADD_ONS.map((a) => (
                  <label key={a.key} className="flex cursor-pointer gap-3 rounded-2xl border border-blue-100 bg-white p-4">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={form.addOns.includes(a.key)} onChange={() => toggleAddOn(a.key)} />
                    <span>
                      <span className={`block font-serif font-bold ${NAVY}`}>{a.title}</span>
                      <span className="text-sm text-gray-600">{a.text}</span>
                    </span>
                  </label>
                ))}
                <div className="rounded-2xl border border-blue-100 bg-white p-4">
                  <label className="flex cursor-pointer gap-3">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={curriculum} onChange={() => toggleAddOn("CURRICULUM")} />
                    <span>
                      <span className={`block font-serif font-bold ${NAVY}`}>Curriculum</span>
                      <span className="text-sm text-gray-600">Ready-to-use lessons, activity ideas, and supply lists.</span>
                    </span>
                  </label>
                  {curriculum ? (
                    <div className="mt-3 space-y-3 border-t border-blue-100 pt-3">
                      {form.programType === "HOME_DAYCARE" ? (
                        <label className={label}>
                          Program
                          <select className={field} value={form.homeDaycareProgram} onChange={(e) => set({ homeDaycareProgram: e.target.value })}>
                            <option value="">Select a program</option>
                            {options.homeDaycarePrograms.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-gray-700">How many classrooms in each age group?</p>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                            {options.ageGroups.map((g) => (
                              <label key={g.key} className="flex items-center justify-between gap-2 text-sm text-gray-800">
                                {g.label}
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  aria-label={`${g.label} classrooms`}
                                  className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
                                  placeholder="0"
                                  value={form.classrooms[g.key] || ""}
                                  onChange={(e) => {
                                    const n = Math.max(0, Math.min(99, Number.parseInt(e.target.value, 10) || 0));
                                    const next = { ...form.classrooms };
                                    if (n) next[g.key] = n;
                                    else delete next[g.key];
                                    set({ classrooms: next });
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <label className={label}>
                        Curriculum Type *
                        <select className={field} value={form.curriculumType} onChange={(e) => set({ curriculumType: e.target.value })}>
                          <option value="">Select a curriculum type</option>
                          {(options?.curriculumTypes || []).map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            </fieldset>

            <input type="text" name="website" value={form.website} onChange={(e) => set({ website: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {state.error ? (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.error}
              </p>
            ) : null}
            <button type="submit" className={`${BTN} w-full py-4 font-serif text-xl`} disabled={state.sending}>
              {state.sending ? "Sending..." : "Submit Request for Quote"}
            </button>
            <p className="text-center text-xs text-gray-500">Your information is secure and will only be used to prepare your personalized quote.</p>
          </form>
        )}

        <aside className="h-fit rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Need Help?</h2>
          <p className="mt-2 text-sm text-gray-700">Have questions before requesting a quote? We are happy to help!</p>
          <ul className="mt-4 space-y-3 text-sm text-gray-800">
            <li className="flex items-center gap-3">
              <Icon name="phone" className="h-5 w-5 text-[#0b2a5b]" />
              {SOLUTIONS_INFO.phone}
            </li>
            <li className="flex items-center gap-3">
              <Icon name="mail" className="h-5 w-5 text-[#0b2a5b]" />
              <a href={`mailto:${SOLUTIONS_INFO.salesEmail}`} className="break-all hover:underline">
                {SOLUTIONS_INFO.salesEmail}
              </a>
            </li>
            <li className="text-gray-600">{SOLUTIONS_INFO.hours}</li>
          </ul>
        </aside>
      </section>
    </SolutionsLayout>
  );
}
