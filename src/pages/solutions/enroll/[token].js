import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import SolutionsLayout, { BTN, BTN_OUTLINE, NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";
import { money } from "@/lib/subscriptionPricing";

// Complete Your Enrollment (client mockup Home-Pages-07). Review the plan,
// agree to the Subscriber Agreement, choose the administrator login and pay
// through Stripe Checkout. Stripe sends them back here with ?session_id=…,
// and the page asks the server to finish (create the account).

const day = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
const CARD = "rounded-3xl border border-blue-100 bg-white p-6 shadow-sm";
const INPUT = "mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-blue-100";

async function getJson(url, init) {
  const r = await fetch(url, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Something went wrong");
  return body;
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-gray-700">{label}</dt>
      <dd className="text-right font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

function Done({ accountNumber, name, email }) {
  return (
    <div className="mt-8 rounded-3xl border border-green-200 bg-green-50 p-8 text-center">
      <h2 className={`font-serif text-3xl font-bold ${NAVY}`}>Welcome to Ameris Solutions!</h2>
      <p className="mt-3 text-lg text-gray-800">
        Your payment went through and {name ? <strong>{name}</strong> : "your account"} is ready{accountNumber ? ` (account ${accountNumber})` : ""}.
      </p>
      <p className="mt-2 text-gray-700">
        Log in{email ? <> with <strong>{email}</strong></> : ""} and the password you chose. Our team will reach out to help you get set up.
      </p>
      <Link href="/login" className={`${BTN} mt-6 px-8 py-3 text-base`}>
        Log In
      </Link>
    </div>
  );
}

export default function SolutionsEnroll() {
  const router = useRouter();
  const token = router.query.token;
  const [quote, setQuote] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [agree, setAgree] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [finished, setFinished] = useState(null);
  const [finishing, setFinishing] = useState("");
  const asked = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;
    const t = encodeURIComponent(token);
    Promise.all([getJson(`/api/v1/solutions/quotes/${t}`), getJson(`/api/v1/solutions/enroll/${t}`)])
      .then(([q, e]) => {
        setQuote(q);
        setInfo(e);
        setForm((f) => ({ ...f, fullName: f.fullName || e.contact?.fullName || "", email: f.email || e.contact?.email || "" }));
      })
      .catch((e) => setError(e.message));
  }, [router.isReady, token]);

  // Back from Stripe: finish the enrollment (retry while Stripe catches up).
  useEffect(() => {
    const sessionId = router.query.session_id;
    if (!router.isReady || !sessionId || asked.current) return;
    asked.current = true;
    setFinishing("Confirming your payment...");
    let tries = 0;
    const attempt = () =>
      getJson(`/api/v1/solutions/enroll/${encodeURIComponent(token)}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then((out) => {
          setFinished(out);
          setFinishing("");
        })
        .catch((e) => {
          if (++tries < 5) setTimeout(attempt, 2000);
          else setFinishing(`${e.message} If you were charged, please contact us at ${SOLUTIONS_INFO.salesEmail}.`);
        });
    attempt();
  }, [router.isReady, router.query.session_id, token]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Centers sign in DocuSign (when it's set up) instead of ticking "I agree".
  const esign = Boolean(info?.signing?.required);
  const signed = info?.signing?.status === "COMPLETED";

  async function pay(e) {
    e.preventDefault();
    setFormError("");
    if (esign) {
      if (!signed) return setFormError("Please review and e-sign your agreement first.");
    } else {
      if (!agree) return setFormError("Please review and agree to the Subscriber Agreement first.");
      if (form.password !== form.confirmPassword) return setFormError("The passwords don't match.");
    }
    setBusy(true);
    try {
      const { url } = await getJson(`/api/v1/solutions/enroll/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(esign ? {} : { ...form, agree, agreementId: info.agreement?.id }),
      });
      window.location.href = url;
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  async function sign() {
    setFormError("");
    if (!form.fullName.trim() || !form.email.trim() || !form.password) return setFormError("Fill in Create Your Account first; the agreement is signed in that name.");
    if (form.password !== form.confirmPassword) return setFormError("The passwords don't match.");
    setBusy(true);
    try {
      const { url } = await getJson(`/api/v1/solutions/enroll/${encodeURIComponent(token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, agreementId: info.agreement?.id }),
      });
      window.location.href = url;
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  // Back from DocuSign: it may take a moment to mark the envelope signed.
  const recheck = useRef(0);
  useEffect(() => {
    if (!router.isReady || router.query.event !== "signing_complete" || !info || signed || info.enrolled || recheck.current >= 5) return;
    const t = setTimeout(() => {
      recheck.current += 1;
      getJson(`/api/v1/solutions/enroll/${encodeURIComponent(token)}`).then(setInfo).catch(() => null);
    }, 2000);
    return () => clearTimeout(t);
  }, [router.isReady, router.query.event, info, signed, token]);

  const q = quote?.quote;
  const c = info?.charges;
  const annual = c?.billingCycle === "ANNUAL";
  const agreement = info?.agreement;
  const canEnroll = info && !info.enrolled && !info.expired && !finished && !finishing;

  return (
    <SolutionsLayout title="Complete Your Enrollment">
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-2 sm:px-6">
        <h1 className={`font-serif text-4xl font-bold sm:text-5xl ${NAVY}`}>Complete Your Enrollment</h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-700">
          Review your personalized plan, sign your agreement, create your account, and complete secure payment to get started with Ameris Solutions.
        </p>

        {error ? (
          <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-amber-900">We couldn&apos;t find this quote. Please contact us at {SOLUTIONS_INFO.salesEmail}.</p>
        ) : finished ? (
          <Done {...finished} />
        ) : finishing ? (
          <p className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-8 text-center text-lg text-gray-800" role="status">
            {finishing}
          </p>
        ) : !quote || !info ? (
          <p className="py-16 text-center text-gray-500">Loading...</p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              {info.enrolled ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
                  This quote has already been used to enroll{info.account ? ` (${info.account.name}, ${info.account.accountNumber})` : ""}.{" "}
                  <Link href="/login" className="font-bold underline">
                    Log in
                  </Link>
                </div>
              ) : info.expired ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                  This quote expired on {day(quote.expiresAt)}. Please contact us at {SOLUTIONS_INFO.phone} or {SOLUTIONS_INFO.salesEmail} for a new one.
                </div>
              ) : esign && router.query.signing && !signed ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900" role="status">
                  {info.signing?.status === "DECLINED"
                    ? "You declined to sign the agreement. If that was a mistake, sign it again below, or contact us with questions."
                    : router.query.event === "signing_complete"
                      ? "Checking your signature with DocuSign..."
                      : "The agreement wasn't signed yet. Click Review & E-Sign Agreement when you're ready."}
                </div>
              ) : router.query.canceled ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Payment was canceled. Nothing was charged; you can try again below.</div>
              ) : null}

              {/* Your Personalized Plan */}
              <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Your Personalized Plan</h2>
                  <p className="text-right text-sm text-gray-600">
                    Quote {quote.number}
                    <br />
                    Valid through {day(quote.expiresAt)}
                  </p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[3fr_2fr]">
                  <ul className="divide-y divide-blue-100 rounded-2xl bg-white px-5">
                    {q.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-4 py-3">
                        <span className="font-semibold text-gray-900">{l.label}</span>
                        <span>{money(l.amount)}</span>
                      </li>
                    ))}
                    {q.discounts.map((d) => (
                      <li key={d.id} className="flex justify-between gap-4 py-3 text-green-800">
                        <span className="font-semibold">{d.label}</span>
                        <span>{money(d.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-2xl bg-white p-5">
                    <h3 className={`font-serif text-lg font-bold ${NAVY}`}>Your Pricing</h3>
                    <p className="mt-2 text-sm text-gray-600">{annual ? "Annual Subscription" : "Monthly Subscription"}</p>
                    <p className={`font-serif text-3xl font-bold ${NAVY}`}>{money(c.recurringAmount)}</p>
                    <p className="mt-3 text-sm text-gray-600">Due today</p>
                    <p className={`font-serif text-2xl font-bold ${NAVY}`}>{money(c.dueToday)}</p>
                    <p className="text-xs text-gray-500">{c.dueTodayNote}</p>
                    <dl className="mt-3 rounded-xl bg-blue-50/60 p-3 text-xs">
                      <div className="flex justify-between py-0.5">
                        <dt>Billing Frequency</dt>
                        <dd className="font-semibold">{annual ? "Annual" : "Monthly"}</dd>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <dt>Start Date</dt>
                        <dd className="font-semibold">{day(c.startDate)}</dd>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <dt>Next Payment</dt>
                        <dd className="font-semibold">{day(c.nextBillingDate)}</dd>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <dt>Initial Term</dt>
                        <dd className="font-semibold">{info.initialTermMonths} months</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="mt-3">
                  <Link href={`/solutions/quote/${encodeURIComponent(token)}`} className="text-sm font-semibold text-[#0b2a5b] underline">
                    View Full Quote
                  </Link>
                </div>
              </div>

              {/* Subscription & Renewal Details */}
              <div className={CARD}>
                <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Subscription &amp; Renewal Details</h2>
                <dl className="mt-3 divide-y divide-gray-100">
                  <Row label="Billing Frequency">{annual ? "Annual" : "Monthly"}</Row>
                  <Row label="Initial Subscription Term">{info.initialTermMonths} months</Row>
                  <Row label="Automatic Renewal">
                    <span className="rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800">Enabled</span>
                  </Row>
                  <Row label="Renewal Period">{info.initialTermMonths} months</Row>
                  <Row label="Cancellation Deadline">Before the renewal date stated in your agreement</Row>
                </dl>
                <div className="mt-3 rounded-2xl bg-blue-50/60 p-4 text-sm text-gray-700">
                  <p className="font-bold text-gray-900">Automatic Renewal Notice</p>
                  Your subscription will automatically renew for another {info.initialTermMonths}-month term at the then-current rate unless you cancel before
                  the renewal deadline. Your payment method will be charged automatically according to your billing schedule.
                </div>
              </div>

              {canEnroll ? (
                <form onSubmit={pay} className="space-y-6" noValidate>
                  {esign ? (
                    <>
                      {/* Centers: the account first, since the agreement is signed in that name. */}
                      {signed ? (
                        <>
                  <div className={CARD}>
                    <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Create Your Account</h2>
                    <p className="mt-2 text-gray-700">
                      Your administrator login: <strong>{info.signing.signer?.fullName}</strong> ({info.signing.signer?.email}) with the password you chose.
                      You&apos;ll log in as soon as your payment goes through.
                    </p>
                  </div>
                        </>
                      ) : (
                        <>
                  {/* Create Your Account */}
                  <div className={CARD}>
                    <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Create Your Account</h2>
                    <p className="mt-1 text-gray-700">This will be your administrator account for your organization.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-gray-800">
                        Full Name <span className="text-red-600">*</span>
                        <input className={INPUT} value={form.fullName} onChange={set("fullName")} autoComplete="name" required />
                      </label>
                      <label className="block text-sm font-semibold text-gray-800">
                        Email Address <span className="text-red-600">*</span>
                        <input className={INPUT} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
                      </label>
                      <label className="block text-sm font-semibold text-gray-800">
                        Password <span className="text-red-600">*</span>
                        <input className={INPUT} type="password" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={8} required />
                        <span className="mt-1 block text-xs font-normal text-gray-500">At least 8 characters.</span>
                      </label>
                      <label className="block text-sm font-semibold text-gray-800">
                        Confirm Password <span className="text-red-600">*</span>
                        <input className={INPUT} type="password" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" required />
                      </label>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">You&apos;ll log in with this email and password as soon as your payment goes through.</p>
                  </div>

                        </>
                      )}
                  {/* Review & E-Sign (centers, DocuSign) */}
                  <div className={CARD}>
                    <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Review &amp; Sign Your Agreement</h2>
                    {agreement ? (
                      <>
                        <p className="mt-2 text-gray-700">
                          Review and electronically sign your Order Form (your plan, pricing and billing terms) and the Ameris Solutions Software Subscription
                          Agreement, including billing terms, cancellation policies, data protection and account responsibilities.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 p-4">
                          <div>
                            <p className="font-bold text-gray-900">{agreement.name}</p>
                            <p className="text-sm text-gray-600">
                              Version {agreement.version}
                              {agreement.effectiveDate ? ` · effective ${day(agreement.effectiveDate)}` : ""}
                            </p>
                          </div>
                          {signed ? (
                            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800">✓ Signed</span>
                          ) : (
                            <button type="button" className={BTN} onClick={sign} disabled={busy}>
                              {busy ? "Opening DocuSign..." : "Review & E-Sign Agreement"}
                            </button>
                          )}
                        </div>
                        {signed ? (
                          <p className="mt-3 text-sm text-gray-700">
                            Signed in DocuSign by <strong>{info.signing.signer?.fullName}</strong>. A signed copy will be kept on your account.
                          </p>
                        ) : (
                          <p className="mt-3 text-sm text-gray-600">You must complete the electronic signature before proceeding to payment.</p>
                        )}
                      </>
                    ) : (
                      <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
                        The Subscriber Agreement isn&apos;t published yet, so online enrollment can&apos;t be finished. Please contact us at {SOLUTIONS_INFO.phone}.
                      </p>
                    )}
                  </div>
                    </>
                  ) : (
                    <>
                  {/* Review & Sign Your Agreement */}
                  <div className={CARD}>
                    <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Review &amp; Sign Your Agreement</h2>
                    {agreement ? (
                      <>
                        <p className="mt-2 text-gray-700">
                          Please review the Ameris Solutions Software Subscription Agreement, including billing terms, cancellation policies, data protection and
                          account responsibilities.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 p-4">
                          <div>
                            <p className="font-bold text-gray-900">{agreement.name}</p>
                            <p className="text-sm text-gray-600">
                              Version {agreement.version}
                              {agreement.effectiveDate ? ` · effective ${day(agreement.effectiveDate)}` : ""}
                            </p>
                          </div>
                          {agreement.url ? (
                            <a href={agreement.url} target="_blank" rel="noreferrer" className={BTN_OUTLINE}>
                              Review Agreement
                            </a>
                          ) : (
                            <button type="button" className={BTN_OUTLINE} onClick={() => setShowAgreement((v) => !v)}>
                              {showAgreement ? "Hide Agreement" : "Review Agreement"}
                            </button>
                          )}
                        </div>
                        {showAgreement && agreement.body ? (
                          <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                            {agreement.body}
                          </div>
                        ) : null}
                        <label className="mt-4 flex items-start gap-3 text-gray-800">
                          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 rounded border-gray-400" />
                          <span>
                            I have read and agree to the <strong>{agreement.name}</strong> (version {agreement.version}), including automatic renewal. I&apos;m
                            authorized to sign for {quote.preparedFor?.centerName || "my program"}.
                          </span>
                        </label>
                        <p className="mt-2 text-xs text-gray-500">We record the date, time, version and your IP address with your agreement.</p>
                      </>
                    ) : (
                      <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
                        The Subscriber Agreement isn&apos;t published yet, so online enrollment can&apos;t be finished. Please contact us at {SOLUTIONS_INFO.phone}.
                      </p>
                    )}
                  </div>

                  {/* Create Your Account */}
                  <div className={CARD}>
                    <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Create Your Account</h2>
                    <p className="mt-1 text-gray-700">This will be your administrator account for your organization.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-gray-800">
                        Full Name <span className="text-red-600">*</span>
                        <input className={INPUT} value={form.fullName} onChange={set("fullName")} autoComplete="name" required />
                      </label>
                      <label className="block text-sm font-semibold text-gray-800">
                        Email Address <span className="text-red-600">*</span>
                        <input className={INPUT} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
                      </label>
                      <label className="block text-sm font-semibold text-gray-800">
                        Password <span className="text-red-600">*</span>
                        <input className={INPUT} type="password" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={8} required />
                        <span className="mt-1 block text-xs font-normal text-gray-500">At least 8 characters.</span>
                      </label>
                      <label className="block text-sm font-semibold text-gray-800">
                        Confirm Password <span className="text-red-600">*</span>
                        <input className={INPUT} type="password" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" required />
                      </label>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">You&apos;ll log in with this email and password as soon as your payment goes through.</p>
                  </div>

                    </>
                  )}

                  {/* Payment */}
                  <div className={CARD}>
                    <h2 className={`font-serif text-2xl font-bold ${NAVY}`}>Payment</h2>
                    <p className="mt-1 text-gray-700">After signing the agreement, continue to complete your secure payment through our trusted provider, Stripe.</p>
                    <div className="mt-4 rounded-2xl bg-blue-50/60 p-4 text-sm text-gray-700">
                      <p className="font-bold text-gray-900">Secure Payment</p>
                      Card details are entered on Stripe&apos;s secure page; we never see your card number. You&apos;ll pay {money(c.dueToday)} today
                      {annual ? ", then each year." : `, then ${money(c.recurringAmount)} on the 1st of each month.`}
                    </div>
                    {formError ? (
                      <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
                        {formError}
                      </p>
                    ) : null}
                    <button type="submit" disabled={busy || !agreement || (esign && !signed)} className={`${BTN} mt-5 w-full py-3 text-base disabled:opacity-60`}>
                      {busy ? "Opening secure payment..." : "Continue to Secure Payment →"}
                    </button>
                    <p className="mt-3 text-center text-xs text-gray-500">
                      By completing your enrollment, you agree to the terms of your signed Software Subscription Agreement. Your information is secure and
                      will only be used to process your subscription.
                    </p>
                  </div>
                </form>
              ) : null}
            </div>

            <aside className="space-y-6">
              <div className={CARD}>
                <h2 className={`font-serif text-xl font-bold ${NAVY}`}>Need to Make Changes?</h2>
                <p className="mt-2 text-sm text-gray-700">
                  If you need to adjust your plan or have questions about your quote, please contact our team before completing your enrollment.
                </p>
                <h3 className={`mt-4 font-serif text-lg font-bold ${NAVY}`}>We&apos;re Here to Help</h3>
                <p className="mt-1 text-sm text-gray-700">
                  {SOLUTIONS_INFO.phone}
                  <br />
                  <a href={`mailto:${SOLUTIONS_INFO.salesEmail}`} className="underline">
                    {SOLUTIONS_INFO.salesEmail}
                  </a>
                  <br />
                  {SOLUTIONS_INFO.hours}
                </p>
              </div>
              <div className={CARD}>
                <h2 className={`font-serif text-xl font-bold ${NAVY}`}>After You Enroll</h2>
                <ol className="mt-4 space-y-4 text-sm text-gray-700">
                  <li>
                    <span className="font-bold text-gray-900">1. Account Setup.</span> Log in right away with the email and password you chose.
                  </li>
                  <li>
                    <span className="font-bold text-gray-900">2. Onboarding.</span> Our team will help you get started and configure your settings.
                  </li>
                  <li>
                    <span className="font-bold text-gray-900">3. Ongoing Support.</span> We&apos;re here to help you succeed with training, resources, and
                    support whenever you need it.
                  </li>
                </ol>
              </div>
            </aside>
          </div>
        )}
      </section>
    </SolutionsLayout>
  );
}
