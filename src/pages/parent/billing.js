import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentPageHeader,
  ParentQuickAction,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ParentBilling() {
  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [centersRes, childrenRes] = await Promise.all([
          apiJson("/api/v1/centers"),
          apiJson("/api/v1/children"),
        ]);
        setCenters(Array.isArray(centersRes) ? centersRes : []);
        setChildren(Array.isArray(childrenRes) ? childrenRes : []);
      } catch (e) {
        setError(e.message || "Failed to load billing details");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const subscriptions = centers
      .map((center) => ({
        centerId: center.id,
        centerName: center.name,
        tier: center.subscription?.tier || "Custom",
        active: Boolean(center.subscription?.active),
        expiresAt: center.subscription?.expiresAt || null,
      }))
      .filter((item) => item.centerName);

    const activeCount = subscriptions.filter((item) => item.active).length;
    const upcomingRenewals = subscriptions.filter((item) => {
      if (!item.expiresAt) return false;
      const expiresAt = new Date(item.expiresAt).getTime();
      return expiresAt >= Date.now() && expiresAt <= Date.now() + 45 * 86400000;
    }).length;

    return {
      subscriptions,
      activeCount,
      upcomingRenewals,
      familyCount: children.length,
    };
  }, [centers, children]);

  return (
    <ParentLayout title="Billing">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Billing center"
          title="Keep tuition and enrollment billing organized"
          description="Review active subscriptions, spot upcoming renewals early, and use the fastest paths for payment or account questions."
          accent="amber"
          layout="split"
          stats={[
            { label: "Children", value: summary.familyCount, hint: "Linked to this account", tone: "sky" },
            { label: "Centers", value: summary.subscriptions.length, hint: "Billing relationships", tone: "gray" },
            { label: "Active plans", value: summary.activeCount, hint: "Currently in good standing", tone: summary.activeCount ? "emerald" : "amber" },
            { label: "Renewals soon", value: summary.upcomingRenewals, hint: "Next 45 days", tone: summary.upcomingRenewals ? "amber" : "gray" },
          ]}
          actions={<ParentButton variant="secondary" onClick={() => alert("Online billing is not implemented yet.")}>Request payment link</ParentButton>}
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <ParentSection
            title="Account summary"
            description="These records are available today. Direct card payments and autopay still need backend support."
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.7)]"
            headerClassName="border-white/10 [&_h2]:text-white [&_p]:text-slate-300"
          >
            {loading ? (
              <Skeleton count={4} />
            ) : summary.subscriptions.length === 0 ? (
              <ParentEmpty
                title="No billing data available yet"
                description="Your center has not published billing records to the portal yet."
              />
            ) : (
              <div className="space-y-3">
                {summary.subscriptions.map((item) => {
                  const expiresSoon =
                    item.expiresAt &&
                    new Date(item.expiresAt) <= new Date(Date.now() + 45 * 86400000) &&
                    new Date(item.expiresAt) >= new Date();
                  return (
                    <div
                      key={item.centerId}
                      className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-base font-extrabold text-white">
                            {item.centerName}
                          </div>
                          <div className="mt-1 text-sm text-slate-200">
                            Plan: {item.tier}
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            Renewal date: {formatDate(item.expiresAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-extrabold",
                              item.active
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                                : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300",
                            ].join(" ")}
                          >
                            {item.active ? "Active" : "Inactive"}
                          </span>
                          {expiresSoon ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                              Renewal soon
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                          <ParentButton variant="soft" onClick={() => alert("Online billing is not implemented yet.")}>
                            Pay now
                          </ParentButton>
                        <ParentButton href="/parent/forms" variant="secondary">
                          Review forms
                        </ParentButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ParentSection>

          <div className="space-y-4">
            <ParentSection
              title="Best next steps"
              description="The billing workflow is still partial, so these shortcuts keep parents moving."
              className="bg-gradient-to-br from-amber-50 via-white to-rose-50/50"
            >
              <div className="grid grid-cols-1 gap-3">
                <ParentQuickAction
                  href="/parent/forms"
                  title="Check expiring forms"
                  description="Many billing delays start with missing renewals or incomplete paperwork."
                />
                <ParentQuickAction
                  href="/parent/messages"
                  title="Message the center"
                  description="Ask for a payment link, invoice clarification, or account correction."
                  tone="emerald"
                />
                <ParentQuickAction
                  href="/parent/notification-settings"
                  title="Keep reminders on"
                  description="Make sure billing and account alerts are visible in your portal."
                  tone="amber"
                />
              </div>
            </ParentSection>

            <ParentSection
              title="Current limitation"
              description="What is and is not supported in the live system."
              className="border-amber-200"
            >
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Card checkout, saved payment methods, autopay, and printable invoices are not wired up in the current backend yet. This page surfaces billing context and gives parents a clearer path to resolve issues until the payment stack is completed.
              </div>
            </ParentSection>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}
