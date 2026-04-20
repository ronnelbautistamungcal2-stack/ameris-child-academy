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
import { buildParentMessageComposeHref } from "@/lib/parentSupport";
import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ParentBilling() {
  const [billingData, setBillingData] = useState({ centers: [], summary: null });
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [billingRes, childrenRes] = await Promise.all([
          apiJson("/api/v1/billing/summary"),
          apiJson("/api/v1/children"),
        ]);
        setBillingData({
          centers: Array.isArray(billingRes?.centers) ? billingRes.centers : [],
          summary: billingRes?.summary || null,
        });
        setChildren(Array.isArray(childrenRes) ? childrenRes : []);
      } catch (e) {
        setError(e.message || "Failed to load billing details");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const subscriptions = (billingData.centers || []).map((center) => ({
      centerId: center.centerId,
      centerName: center.centerName,
      tier: center.tier || "Custom",
      active: Boolean(center.active),
      expiresAt: center.expiresAt || null,
      actions: center.actions || {},
      provider: center.provider || null,
      supportEmail: center.supportEmail || null,
      invoiceEmail: center.invoiceEmail || null,
      cardLabel: center.cardLabel || null,
      autopayEnabled: Boolean(center.autopayEnabled),
    }));

    const activeCount = subscriptions.filter((item) => item.active).length;
    const upcomingRenewals = subscriptions.filter((item) => {
      if (!item.expiresAt) return false;
      const expiresAt = new Date(item.expiresAt).getTime();
      return expiresAt >= Date.now() && expiresAt <= Date.now() + 45 * 86400000;
    }).length;
    const paymentToolCount = subscriptions.filter(
      (item) => item.actions.portalUrl || item.actions.paymentLinkUrl,
    ).length;
    const autopayCount = subscriptions.filter((item) => item.autopayEnabled).length;
    const supportContacts = subscriptions.flatMap((item) => {
      const contacts = [];
      if (item.supportEmail) {
        contacts.push({
          id: `${item.centerId}-support`,
          centerName: item.centerName,
          label: "Support email",
          value: item.supportEmail,
        });
      }
      if (item.invoiceEmail) {
        contacts.push({
          id: `${item.centerId}-invoice`,
          centerName: item.centerName,
          label: "Invoice email",
          value: item.invoiceEmail,
        });
      }
      return contacts;
    });

    return {
      subscriptions,
      activeCount,
      upcomingRenewals,
      familyCount: children.length,
      paymentToolCount,
      autopayCount,
      supportContacts,
    };
  }, [billingData.centers, children]);

  const generalBillingHref = buildParentMessageComposeHref({
    subject: "Billing support request",
    message:
      "Hello, I need help with tuition or account billing. Please share the next steps or a payment link when available.",
  });

  const primaryAction = useMemo(() => {
    const portal = summary.subscriptions.find((item) => item.actions.portalUrl);
    if (portal) {
      return {
        href: portal.actions.portalUrl,
        label: "Open billing portal",
      };
    }

    const paymentLink = summary.subscriptions.find(
      (item) => item.actions.paymentLinkUrl,
    );
    if (paymentLink) {
      return {
        href: paymentLink.actions.paymentLinkUrl,
        label: "Open payment link",
      };
    }

    return {
      href: generalBillingHref,
      label: "Request payment link",
    };
  }, [generalBillingHref, summary.subscriptions]);

  const readinessItems = useMemo(
    () => [
      {
        title: "Payment tools",
        detail: summary.paymentToolCount
          ? `${summary.paymentToolCount} center account${summary.paymentToolCount === 1 ? "" : "s"} already expose a billing portal or hosted payment link.`
          : "No hosted payment path is visible yet, so the fastest route is messaging the center for a payment link.",
        tone: summary.paymentToolCount ? "emerald" : "amber",
      },
      {
        title: "Renewals",
        detail: summary.upcomingRenewals
          ? `${summary.upcomingRenewals} account renewal${summary.upcomingRenewals === 1 ? "" : "s"} falls within the next 45 days.`
          : "No near-term billing renewal deadlines are showing right now.",
        tone: summary.upcomingRenewals ? "amber" : "emerald",
      },
      {
        title: "Autopay",
        detail: summary.autopayCount
          ? `${summary.autopayCount} center account${summary.autopayCount === 1 ? "" : "s"} show autopay as enabled.`
          : "Autopay is not visible on any linked billing record right now.",
        tone: summary.autopayCount ? "sky" : "gray",
      },
    ],
    [summary.autopayCount, summary.paymentToolCount, summary.upcomingRenewals],
  );

  return (
    <ParentLayout title="Billing">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Billing center"
          title="See the fastest path to payment, renewal, or billing help"
          description="Review each linked center account, spot renewals before they become urgent, and move directly into the portal, payment link, or support conversation that makes sense."
          accent="amber"
          layout="split"
          stats={[
            {
              label: "Children",
              value: summary.familyCount,
              hint: "Linked to this account",
              tone: "sky",
            },
            {
              label: "Active plans",
              value: summary.activeCount,
              hint: "Currently in good standing",
              tone: summary.activeCount ? "emerald" : "amber",
            },
            {
              label: "Payment tools",
              value: summary.paymentToolCount,
              hint: "Portal or hosted link ready",
              tone: summary.paymentToolCount ? "emerald" : "gray",
            },
            {
              label: "Renewals soon",
              value: summary.upcomingRenewals,
              hint: "Next 45 days",
              tone: summary.upcomingRenewals ? "amber" : "gray",
            },
          ]}
          actions={
            <div className="flex flex-wrap gap-2">
              <ParentButton href={primaryAction.href}>{primaryAction.label}</ParentButton>
              {primaryAction.label !== "Request payment link" ? (
                <ParentButton href={generalBillingHref} variant="soft">
                  Request payment link
                </ParentButton>
              ) : null}
              <ParentButton href="/parent/forms" variant="secondary">
                Review forms
              </ParentButton>
            </div>
          }
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <ParentSection
            title="Billing overview by center"
            description="Each card gives you the renewal date, available payment path, and support details without making you leave the page."
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
              <div className="space-y-4">
                {summary.subscriptions.map((item) => {
                  const expiresSoon =
                    item.expiresAt &&
                    new Date(item.expiresAt) <= new Date(Date.now() + 45 * 86400000) &&
                    new Date(item.expiresAt) >= new Date();

                  const supportHref = buildParentMessageComposeHref({
                    subject: `Billing support for ${item.centerName}`,
                    message: `Hello, I need help with billing for ${item.centerName}. Please share the next steps or a payment link when available.`,
                  });

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
                        {item.actions.portalUrl ? (
                          <ParentButton href={item.actions.portalUrl} variant="soft">
                            Open billing portal
                          </ParentButton>
                        ) : item.actions.paymentLinkUrl ? (
                          <ParentButton href={item.actions.paymentLinkUrl} variant="soft">
                            Open payment link
                          </ParentButton>
                        ) : (
                          <ParentButton href={supportHref} variant="soft">
                            Request payment link
                          </ParentButton>
                        )}
                        <ParentButton href={supportHref} variant="secondary">
                          Message billing support
                        </ParentButton>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs text-slate-200 sm:grid-cols-2 xl:grid-cols-5">
                        <BillingFact label="Provider" value={item.provider || "-"} />
                        <BillingFact label="Card" value={item.cardLabel || "-"} />
                        <BillingFact
                          label="Autopay"
                          value={item.autopayEnabled ? "Enabled" : "Off"}
                        />
                        <BillingFact
                          label="Support"
                          value={item.supportEmail || "-"}
                          breakWords
                        />
                        <BillingFact
                          label="Invoices"
                          value={item.invoiceEmail || "-"}
                          breakWords
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ParentSection>

          <div className="space-y-4">
            <ParentSection
              title="Billing readiness"
              description="A fast read on whether this account is ready for self-service payment or needs center follow-up."
              className="bg-gradient-to-br from-white via-amber-50/40 to-white"
            >
              <div className="space-y-3">
                {readinessItems.map((item) => (
                  <ReadinessCard key={item.title} item={item} />
                ))}
              </div>
            </ParentSection>

            <ParentSection
              title="Support contacts"
              description="Use these contact points when the portal is missing a payment path or an invoice needs clarification."
              className="border-sky-100"
            >
              {summary.supportContacts.length ? (
                <div className="space-y-3">
                  {summary.supportContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-[22px] border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                    >
                      <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                        {contact.centerName}
                      </div>
                      <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        {contact.label}
                      </div>
                      <div className="mt-2 break-all text-sm text-gray-600 dark:text-gray-300">
                        {contact.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ParentEmpty
                  title="No billing contacts listed"
                  description="Use the message flow below to request the right billing contact from the center."
                />
              )}
            </ParentSection>

            <ParentSection
              title="Best next steps"
              description="These shortcuts keep billing questions from stalling when the exact payment path is not obvious."
              className="bg-gradient-to-br from-amber-50 via-white to-rose-50/50"
            >
              <div className="grid grid-cols-1 gap-3">
                <ParentQuickAction
                  href={primaryAction.href}
                  title={primaryAction.label}
                  description="Use the fastest payment route currently visible for this family account."
                  tone="emerald"
                />
                <ParentQuickAction
                  href="/parent/forms"
                  title="Check expiring forms"
                  description="Many billing or enrollment delays start with missing renewals or incomplete paperwork."
                />
                <ParentQuickAction
                  href={generalBillingHref}
                  title="Message the center"
                  description="Ask for a payment link, invoice clarification, or account correction."
                  tone="sky"
                />
                <ParentQuickAction
                  href="/parent/notification-settings"
                  title="Keep reminders on"
                  description="Make sure billing and form-renewal alerts stay visible in your portal."
                  tone="amber"
                />
              </div>
            </ParentSection>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}

function BillingFact({ label, value, breakWords = false }) {
  return (
    <div>
      <div className="font-bold uppercase tracking-[0.16em] text-slate-300">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-white",
          breakWords ? "break-all" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function ReadinessCard({ item }) {
  const tones = {
    emerald:
      "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100",
    sky: "border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-100",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100",
  };

  return (
    <div className={`rounded-[22px] border p-4 ${tones[item.tone] || tones.gray}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-70">
        {item.title}
      </div>
      <div className="mt-2 text-sm leading-6">{item.detail}</div>
    </div>
  );
}
