import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { apiJson } from "@/lib/api";

// "I agree" screen (client 2026-11-11). Every staff member and parent accepts
// the current End-User Terms of Use (and any other login terms) before using
// the portal; the middleware sends them here until they do. Each acceptance
// is recorded with the date, time, user and version.

function dateOf(value) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function TermsPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [pending, setPending] = useState(null);
  const [agreed, setAgreed] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const next = () => {
    const target = typeof router.query.callbackUrl === "string" && router.query.callbackUrl.startsWith("/") ? router.query.callbackUrl : "/dashboard";
    window.location.assign(target);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status !== "authenticated") return;
    apiJson("/api/v1/terms")
      .then((d) => setPending(d.pending || []))
      .catch((e) => setError(e.message || "Could not load the terms"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Nothing left to accept (e.g. accepted in another tab): carry on.
  useEffect(() => {
    if (pending && !pending.length) {
      update({ termsPending: false }).finally(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const allAgreed = pending?.length && pending.every((d) => agreed[d.id]);

  async function accept() {
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/terms", { method: "POST", body: JSON.stringify({ documentIds: pending.map((d) => d.id) }) });
      await update({ termsPending: false });
      next();
    } catch (e) {
      setError(e.message || "Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef3fb] px-4 py-8 dark:bg-gray-950">
      <Head>
        <title>Terms of Use | Ameris Solutions</title>
      </Head>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="w-44">
            <AmerisLogo size="lg" showText={false} className="max-w-full" />
          </div>
          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm font-semibold text-blue-800 underline dark:text-blue-200">
            Sign out
          </button>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h1 className="text-2xl font-extrabold text-[#16305e] dark:text-blue-100">Before you continue</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {session?.user?.name ? `Hi ${session.user.name}. ` : ""}Please read and accept these terms to use Ameris Solutions.
          </p>
          {error ? <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {!pending ? (
            <p className="mt-6 text-sm text-gray-500">Loading...</p>
          ) : (
            <div className="mt-5 space-y-6">
              {pending.map((d) => (
                <section key={d.id}>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{d.title}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Version {d.version} · {dateOf(d.publishedAt)}
                  </p>
                  <div
                    className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    tabIndex={0}
                    aria-label={d.title}
                  >
                    {d.body}
                  </div>
                  <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={Boolean(agreed[d.id])} onChange={(e) => setAgreed((a) => ({ ...a, [d.id]: e.target.checked }))} />
                    I have read and agree to the {d.title}.
                  </label>
                </section>
              ))}
              <div className="flex justify-end">
                <button type="button" onClick={accept} disabled={!allAgreed || saving} className="rounded-xl bg-blue-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">
                  {saving ? "Saving..." : "I Agree"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
