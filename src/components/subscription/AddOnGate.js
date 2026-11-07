import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ADD_ON_LABELS, missingAddOns } from "@/lib/addOns";
import { apiJson } from "@/lib/api";

// One fetch shared by every shell and gate on screen. Each role page mounts
// its own AppShell, so without this every navigation would refetch.
const CACHE_MS = 60 * 1000;
let cache = { key: "", at: 0, promise: null, value: null };

function loadAccount(key) {
  const fresh = cache.key === key && Date.now() - cache.at < CACHE_MS;
  if (fresh && cache.promise) return cache.promise;
  const promise = apiJson("/api/v1/account")
    .then((data) => ({ addOns: data?.addOns ?? null, account: data?.account || null, loaded: true }))
    .catch(() => ({ addOns: null, account: null, loaded: true }));
  cache = { key, at: Date.now(), promise, value: null };
  promise.then((value) => {
    if (cache.promise === promise) cache.value = value;
  });
  return promise;
}

/** Forget the cached add-ons, e.g. after the Global admin changes them. */
export function refreshAddOns() {
  cache = { key: "", at: 0, promise: null, value: null };
}

/**
 * The signed-in person's subscriber add-ons: { addOns, account, loaded }.
 * addOns is null when they have no account, which means nothing is locked.
 */
export function useAddOns() {
  const { data: session, status } = useSession();
  const key = status === "authenticated" ? `${session?.user?.id}:${session?.user?.role}` : "";
  const [state, setState] = useState(() =>
    cache.key === key && cache.value ? cache.value : { addOns: null, account: null, loaded: false },
  );
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    loadAccount(key).then((value) => {
      if (!cancelled) setState(value);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return state;
}

/** True when every add-on in `needed` is on (or the person has no account). */
export function useHasAddOns(needed) {
  const { addOns } = useAddOns();
  return missingAddOns([].concat(needed || []), addOns).length === 0;
}

function UpgradeNotice({ missing, compact = false }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const names = missing.map((key) => ADD_ON_LABELS[key] || key).join(" and ");
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-center dark:border-gray-700 dark:bg-gray-900",
        compact ? "px-4 py-6" : "px-6 py-16",
      ].join(" ")}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={compact ? "h-6 w-6 text-gray-400" : "h-10 w-10 text-gray-400"} aria-hidden="true">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
      </svg>
      <div className={compact ? "text-sm font-bold text-gray-700 dark:text-gray-200" : "text-lg font-bold text-gray-800 dark:text-gray-100"}>
        This {compact ? "section" : "page"} is part of the {names} add-on
      </div>
      <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
        {isAdmin
          ? "Upgrade your subscription to unlock it. Anything saved before stays saved and comes back when you upgrade."
          : "Ask your center administrator about upgrading your subscription."}
      </p>
      {isAdmin ? (
        <Link
          href="/admin/subscription"
          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          Upgrade
        </Link>
      ) : null}
    </div>
  );
}

/** One greyed-out value in a table column the account hasn't unlocked. */
export function LockedValue({ addOn }) {
  const names = [].concat(addOn || []).map((key) => ADD_ON_LABELS[key] || key).join(" and ");
  return (
    <span title={`Part of the ${names} add-on`} aria-label={`Locked: part of the ${names} add-on`} className="text-gray-400">
      {"\u{1F512}"}
    </span>
  );
}

/** Whole-page lock, shown by AppShell in place of a locked page. */
export function LockedPage({ missing }) {
  return <UpgradeNotice missing={missing} />;
}

/**
 * Greys out one section of a page when the account lacks an add-on:
 *   <AddOnGate addOn="STEPS_OF_PROGRESSION">...milestones...</AddOnGate>
 * Pass several to require all of them.
 */
export default function AddOnGate({ addOn, children }) {
  const { addOns } = useAddOns();
  const missing = missingAddOns([].concat(addOn || []), addOns);
  if (!missing.length) return children;
  return <UpgradeNotice missing={missing} compact />;
}
