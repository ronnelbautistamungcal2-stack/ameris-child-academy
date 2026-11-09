import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";

// Parent dashboard "Sign Children In / Out" (client sheet 2026-11-07, mockup
// r044): the parent enters their kiosk PIN, then signs one child or all the
// selected children in or out. Each sign in or out records the time it is
// saved.

const NAVY = "text-[#12386a] dark:text-sky-100";
const PIN_LENGTH = 6;

function timeOf(value) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}

function PinStep({ onVerified }) {
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function setDigit(i, value) {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole PIN.
      const next = clean.slice(0, PIN_LENGTH).split("");
      setDigits(Array.from({ length: PIN_LENGTH }, (_, j) => next[j] || ""));
      inputs.current[Math.min(next.length, PIN_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((cur) => cur.map((d, j) => (j === i ? clean : d)));
    if (clean && i < PIN_LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  async function submit(event) {
    event.preventDefault();
    const pin = digits.join("");
    if (pin.length !== PIN_LENGTH) return setError("Enter all 6 digits of your PIN.");
    setChecking(true);
    setError("");
    try {
      const result = await apiJson("/api/v1/me/pin-check", { method: "POST", body: JSON.stringify({ pin }) });
      if (result.noPin) setError("You have not set a kiosk PIN yet. Register at the front desk kiosk to choose one.");
      else if (!result.ok) {
        setError("That PIN is not correct.");
        setDigits(Array(PIN_LENGTH).fill(""));
        inputs.current[0]?.focus();
      } else onVerified();
    } catch (e) {
      setError(e.message || "Could not check your PIN");
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-center">
      <h2 className={`text-2xl font-black ${NAVY}`}>Enter Your PIN</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">Please enter your 6-digit PIN to continue.</p>
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            type="password"
            maxLength={PIN_LENGTH}
            aria-label={`PIN digit ${i + 1}`}
            className="h-12 w-10 rounded-lg border border-gray-300 text-center text-xl font-bold dark:border-gray-600 dark:bg-gray-800"
          />
        ))}
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      <button type="submit" disabled={checking} className="w-full rounded-xl bg-[#12386a] py-3 text-sm font-bold text-white hover:bg-[#0d2a52] disabled:opacity-60">
        {checking ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}

/**
 * childList: [{ id, name, initials, signedIn, signedInAt, signedOutAt }].
 * onChanged(childId, signedIn) after each sign in or out is saved.
 */
export default function SignInOutDialog({ childList, onChanged, onClose }) {
  const [verified, setVerified] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chosen = useMemo(() => childList.filter((c) => selected.includes(c.id)), [childList, selected]);
  // The footer signs the selected children out when they are all in; otherwise
  // it signs in the ones that are not in yet.
  const signOutAll = chosen.length > 0 && chosen.every((c) => c.signedIn);

  async function sign(children, signIn) {
    setBusy(children.length > 1 ? "all" : children[0]?.id || "");
    setError("");
    try {
      for (const child of children) {
        await apiJson(signIn ? "/api/v1/attendance/check-in" : "/api/v1/attendance/check-out", {
          method: "POST",
          body: JSON.stringify({ childId: child.id }),
        });
        onChanged(child.id, signIn);
      }
      setSelected([]);
    } catch (e) {
      setError(e.message || "Could not update sign in");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Sign Children In / Out">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-3 text-2xl text-gray-500 hover:text-gray-800">
          &times;
        </button>
        {!verified ? (
          <div className="mx-auto max-w-sm">
            <PinStep onVerified={() => setVerified(true)} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
              <h2 className={`text-2xl font-black ${NAVY}`}>Sign Children In / Out</h2>
              <div className="rounded-xl bg-sky-50 px-4 py-2 text-center dark:bg-sky-900/30">
                <div className={`text-xs font-semibold ${NAVY}`}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
                <div className={`text-xl font-black ${NAVY}`}>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-50 text-left text-xs font-bold text-gray-600 dark:bg-sky-900/30 dark:text-gray-300">
                  <th className="w-8 px-2 py-2">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-2 py-2">Child</th>
                  <th className="px-2 py-2">Current Status</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {childList.map((child) => (
                  <tr key={child.id}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${child.name}`}
                        checked={selected.includes(child.id)}
                        onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, child.id] : cur.filter((id) => id !== child.id)))}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-black text-sky-800">{child.initials}</span>
                        <span className={`font-bold ${NAVY}`}>{child.name}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {child.signedIn ? (
                        <span className="font-semibold text-emerald-700">
                          ● Signed In{child.signedInAt ? <span className="block font-normal text-gray-500">Today at {timeOf(child.signedInAt)}</span> : null}
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-500">
                          ● Not Signed In{child.signedOutAt ? <span className="block font-normal">Signed out at {timeOf(child.signedOutAt)}</span> : null}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => sign([child], !child.signedIn)}
                        className={
                          child.signedIn
                            ? "rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                            : "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                        }
                      >
                        {busy === child.id ? "Saving..." : child.signedIn ? "Sign Out" : "Sign In"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
              ⓘ The time will be recorded for all selected children.
            </p>
            {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200">
                Cancel
              </button>
              <button
                type="button"
                disabled={!chosen.length || Boolean(busy)}
                onClick={() => sign(signOutAll ? chosen : chosen.filter((c) => !c.signedIn), !signOutAll)}
                className="rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === "all" ? "Saving..." : signOutAll ? "Sign Out Selected" : "Sign In Selected"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
