import { useState } from "react";
import PublicLayout from "@/components/public/PublicLayout";
import { CheckIcon, CreditCardIcon } from "@/components/public/icons";

/* ── Data ─────────────────────────────────────────────── */

const TIERS = [
  {
    name: "Basic",
    price: "$199",
    period: "/month",
    features: [
      "Full Curriculum Suite",
      "Progression Tracking",
      "Up to 3 Center Admin",
    ],
    cta: "Select Professional",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$399",
    period: "/month",
    features: [
      "Full Curriculum Suite",
      "Progression Tracking",
      "Up to 5 Center Admin",
      "Teacher Training Portal",
    ],
    cta: "Select Professional",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$399",
    period: "/month",
    features: [
      "Full Curriculum Suite",
      "Progression Tracking",
      "Up to 5 Center Admin",
      "Teacher Training Portal",
    ],
    cta: "Select Professional",
    highlighted: false,
  },
];

const FEATURES = [
  { label: "Curriculum Access", defaultOn: true },
  { label: "Progression Tracking", defaultOn: true },
  { label: "Custom Branding", defaultOn: false },
];

/* ── Page ─────────────────────────────────────────────── */

export default function ExternalClientsPage() {
  return (
    <PublicLayout title="External Clients" description="Scale your childcare business with Ameris">
      <HeroSection />
      <PricingSection />
      <BillingSection />
    </PublicLayout>
  );
}

/* ── Hero ─────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <span className="inline-block rounded-full bg-sky-100 px-4 py-1.5 text-xs font-semibold text-sky-700">
          For Professional Daycare Centers
        </span>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
          Empower Your Center with{" "}
          <span className="text-sky-600">Ameris</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          Scale your childcare business with our premium curriculum, management tools, and
          comprehensive training resources.
        </p>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────────── */

function PricingSection() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={[
                "rounded-2xl border p-6 transition",
                tier.highlighted
                  ? "border-sky-300 bg-sky-50 shadow-lg ring-2 ring-sky-200"
                  : "border-gray-200 bg-white",
              ].join(" ")}
            >
              <h3 className="text-sm font-semibold text-gray-500">{tier.name}</h3>
              <div className="mt-2">
                <span className="text-4xl font-extrabold text-gray-900">{tier.price}</span>
                <span className="text-sm text-gray-500">{tier.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckIcon className="h-4 w-4 flex-shrink-0 text-sky-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={[
                  "mt-8 w-full rounded-2xl px-4 py-3 text-sm font-extrabold transition",
                  tier.highlighted
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
                ].join(" ")}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Billing + Feature Management ─────────────────────── */

function BillingSection() {
  const [billing, setBilling] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    address: "",
  });
  const [features, setFeatures] = useState(
    FEATURES.reduce((acc, f) => ({ ...acc, [f.label]: f.defaultOn }), {})
  );

  function handleBilling(e) {
    setBilling((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleFeature(label) {
    setFeatures((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Billing Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
            <h2 className="text-xl font-extrabold text-gray-900">Secure Billing Information</h2>
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Credit Card Number</span>
                <div className="relative mt-1">
                  <input
                    type="text"
                    name="cardNumber"
                    value={billing.cardNumber}
                    onChange={handleBilling}
                    placeholder="0000 0000 00000 0000"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                  />
                  <CreditCardIcon className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-5">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expiry Date</span>
                  <input
                    type="text"
                    name="expiry"
                    value={billing.expiry}
                    onChange={handleBilling}
                    placeholder="MM / YYYY"
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">CVV</span>
                  <input
                    type="text"
                    name="cvv"
                    value={billing.cvv}
                    onChange={handleBilling}
                    placeholder="123"
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Billing Address</span>
                <input
                  type="text"
                  name="address"
                  value={billing.address}
                  onChange={handleBilling}
                  placeholder="Street Address, City, State, ZIP"
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                />
              </label>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                Active Subscription: <span className="font-semibold text-gray-700">Professional</span>
                <br />
                Next Billing Date: November 1, 2026
              </div>

              <button
                type="button"
                className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-sky-700"
              >
                Update Payment Method
              </button>
            </div>
          </div>

          {/* Feature Management */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
            <h2 className="text-xl font-extrabold text-gray-900">Feature Management</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Active Features</p>

            <div className="mt-6 space-y-4">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={features[f.label]}
                    onClick={() => toggleFeature(f.label)}
                    className={[
                      "relative inline-flex h-6 w-11 items-center rounded-full transition",
                      features[f.label] ? "bg-sky-600" : "bg-gray-200",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-4 w-4 rounded-full bg-white transition",
                        features[f.label] ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-5">
              <h3 className="text-sm font-extrabold text-sky-800">Enterprise Upgrade Available</h3>
              <p className="mt-2 text-sm text-sky-700">
                Unlock Custom Branding and Multi-center API by upgrading to the Enterprise plan.
              </p>
              <button
                type="button"
                className="mt-4 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
