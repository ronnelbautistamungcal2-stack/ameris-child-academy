import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SolutionsLayout, { BTN, NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";
import { money } from "@/lib/subscriptionPricing";

// Complete Your Enrollment (client mockup 2026-11-06). Signing the agreement,
// creating the account and paying are being built (Stripe, DocuSign); until
// then this page shows the plan and how to finish with the Ameris team.

export default function SolutionsEnroll() {
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

  return (
    <SolutionsLayout title="Complete Your Enrollment">
      <section className="mx-auto max-w-5xl px-4 pb-14 pt-2 sm:px-6">
        <h1 className={`font-serif text-4xl font-bold sm:text-5xl ${NAVY}`}>Complete Your Enrollment</h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-700">
          Review your personalized plan, sign your agreement, create your account, and complete secure payment to get started with Ameris Solutions.
        </p>
        {error ? (
          <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-amber-900">We couldn&apos;t find this quote. Please contact us at {SOLUTIONS_INFO.salesEmail}.</p>
        ) : !data ? (
          <p className="py-16 text-center text-gray-500">Loading...</p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Your Personalized Plan</h2>
                  <p className="text-sm text-gray-600">Quote {data.number}</p>
                </div>
                <ul className="mt-4 divide-y divide-blue-100 rounded-2xl bg-white px-5">
                  {data.quote.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-4 py-3">
                      <span className="font-semibold text-gray-900">{l.label}</span>
                      <span>{money(l.amount)}</span>
                    </li>
                  ))}
                  {data.quote.discounts.map((d) => (
                    <li key={d.id} className="flex justify-between gap-4 py-3 text-green-800">
                      <span className="font-semibold">{d.label}</span>
                      <span>{money(d.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className={`mt-4 text-right font-serif text-2xl font-bold ${NAVY}`}>Monthly Subscription: {money(data.quote.monthly)}</p>
              </div>
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <h2 className="font-serif text-xl font-bold">Online sign-up is almost ready</h2>
                <p className="mt-2">
                  Signing your agreement and secure online payment are being set up. To complete your enrollment now, please contact our team and we will
                  finish it with you.
                </p>
                <p className="mt-3 font-semibold">
                  {SOLUTIONS_INFO.phone} · <a href={`mailto:${SOLUTIONS_INFO.salesEmail}`} className="underline">{SOLUTIONS_INFO.salesEmail}</a>
                </p>
              </div>
            </div>
            <aside className="h-fit rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
              <h2 className={`font-serif text-xl font-bold ${NAVY}`}>After You Enroll</h2>
              <ol className="mt-4 space-y-4 text-sm text-gray-700">
                <li>
                  <span className="font-bold text-gray-900">1. Account Setup.</span> You&apos;ll receive a welcome email with login instructions.
                </li>
                <li>
                  <span className="font-bold text-gray-900">2. Onboarding.</span> Our team will help you get started and configure your settings.
                </li>
                <li>
                  <span className="font-bold text-gray-900">3. Ongoing Support.</span> We&apos;re here to help you succeed with training, resources, and
                  support whenever you need it.
                </li>
              </ol>
              <Link href={`/solutions/quote/${encodeURIComponent(router.query.token)}`} className={`${BTN} mt-6 w-full`}>
                Back to My Quote
              </Link>
            </aside>
          </div>
        )}
      </section>
    </SolutionsLayout>
  );
}
