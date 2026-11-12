import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SolutionsLayout, { BTN, NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";
import { money } from "@/lib/subscriptionPricing";

// Ameris Solutions quote (client mockup 2026-11-06): what the Ameris team
// generated in Sales & Leads, opened from the link they send the prospect.

const day = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
const longDay = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

export default function SolutionsQuote() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    fetch(`/api/v1/solutions/quotes/${encodeURIComponent(router.query.token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Quote not found");
        setData(body);
      })
      .catch((e) => setError(e.message));
  }, [router.isReady, router.query.token]);

  const q = data?.quote;
  const annual = q?.billingCycle === "ANNUAL";

  return (
    <SolutionsLayout title={data ? `Quote ${data.number}` : "Your Quote"}>
      <section className="mx-auto max-w-3xl px-4 pb-14 pt-2 sm:px-6">
        {error ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900">
            <h1 className="font-serif text-2xl font-bold">We couldn&apos;t find this quote</h1>
            <p className="mt-2">The link may be incomplete. Please contact us at {SOLUTIONS_INFO.salesEmail} and we&apos;ll send it again.</p>
          </div>
        ) : !data ? (
          <p className="py-16 text-center text-gray-500">Loading your quote...</p>
        ) : (
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none sm:p-8">
            <div className="flex flex-col gap-6 border-b border-gray-200 pb-6 sm:flex-row sm:justify-between">
              <div className="text-sm text-gray-700">
                <p className={`font-serif text-2xl font-bold ${NAVY}`}>Ameris Solutions</p>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0b2a5b]">{SOLUTIONS_INFO.tagline}</p>
                <p className="mt-3">{SOLUTIONS_INFO.shortLocation}</p>
                <p>{SOLUTIONS_INFO.phone}</p>
                <p>{SOLUTIONS_INFO.email}</p>
              </div>
              <div className="sm:border-l sm:border-gray-200 sm:pl-8">
                <h1 className={`font-serif text-5xl font-bold ${NAVY}`}>Quote</h1>
                <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
                  <dt className="font-bold text-gray-900">Quote #:</dt>
                  <dd>{data.number}</dd>
                  <dt className="font-bold text-gray-900">Quote Date:</dt>
                  <dd>{day(data.date)}</dd>
                  <dt className="font-bold text-gray-900">Expiration Date:</dt>
                  <dd>{day(data.expiresAt)}</dd>
                </dl>
              </div>
            </div>

            <div className="py-6">
              <h2 className={`font-serif text-xl font-bold ${NAVY}`}>Prepared For:</h2>
              <div className="mt-2 text-gray-800">
                <p className="font-bold">{data.preparedFor.centerName}</p>
                <p>Attn: {data.preparedFor.contactName}</p>
                <p>{data.preparedFor.email}</p>
                {data.preparedFor.phone ? <p>{data.preparedFor.phone}</p> : null}
                {data.preparedFor.location ? <p>{data.preparedFor.location}</p> : null}
              </div>
            </div>

            <table className="w-full overflow-hidden rounded-2xl border border-gray-200 text-left">
              <thead className="bg-blue-50">
                <tr>
                  <th className={`px-4 py-3 font-serif text-lg ${NAVY}`}>Description</th>
                  <th className={`px-4 py-3 text-right font-serif text-lg ${NAVY}`}>Monthly Price</th>
                </tr>
              </thead>
              <tbody>
                {q.lines.map((l, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900">{l.label}</span>
                      {l.kind === "ADD_ON" ? <span className="text-gray-600"> (Add-On)</span> : null}
                      {l.detail ? <span className="block text-xs text-gray-500">{l.detail}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{money(l.amount)}</td>
                  </tr>
                ))}
                {q.discounts.map((d) => (
                  <tr key={d.id} className="border-t border-gray-200 text-green-800">
                    <td className="px-4 py-3 font-bold">{d.label}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {q.curriculumDetails?.length ? (
              <div className="mt-5 grid gap-4 rounded-2xl border border-gray-200 bg-blue-50/40 p-5 sm:grid-cols-[auto_1fr_auto]">
                <h3 className={`font-serif text-xl font-bold ${NAVY}`}>Curriculum Details</h3>
                <ul className="list-disc space-y-1 pl-5 text-gray-800">
                  {q.curriculumDetails.map((c) => (
                    <li key={c.label}>
                      <span className="font-bold">{c.label}</span>
                      {c.classrooms ? `: ${c.classrooms} classroom${c.classrooms === 1 ? "" : "s"}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="font-bold text-gray-900">{q.curriculumVersion === "FAITH_BASED" ? "Non-Denominational Christian" : "Non-Denominational"}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col items-end gap-1">
              {/* Annual plans: the yearly amount they pay is the big number (client sheet 10-29, row 40). */}
              <div className="flex items-center gap-8 rounded-2xl bg-blue-50 px-6 py-4">
                <span className={`font-serif text-2xl font-bold ${NAVY}`}>{annual ? "Total Due (Billed Annually):" : "Total Due (Monthly):"}</span>
                <span className={`font-serif text-3xl font-bold ${NAVY}`}>{money(annual ? q.periodTotal : q.monthly)}</span>
              </div>
              {annual ? <p className="text-sm text-gray-600">One payment for 12 months (equal to {money(q.monthly)} a month)</p> : null}
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 text-center">
              <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Ready to Get Started?</h2>
              <p className="mx-auto mt-2 max-w-lg text-gray-700">To accept this quote, review and sign your agreement, create your account, and set up your payment information.</p>
              {data.expired ? (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">This quote has expired. Please contact us for an updated quote.</p>
              ) : (
                <Link href={`/solutions/enroll/${encodeURIComponent(router.query.token)}`} className={`${BTN} mt-5 px-8 py-3 text-lg print:hidden`}>
                  Complete Your Enrollment →
                </Link>
              )}
              <p className="mt-6 text-sm italic text-gray-600">Quote valid through {longDay(data.expiresAt)}.</p>
              <button type="button" onClick={() => window.print()} className="mt-3 text-sm font-semibold text-blue-800 underline print:hidden">
                Print this quote
              </button>
            </div>
          </article>
        )}
      </section>
    </SolutionsLayout>
  );
}
