import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { apiJson } from "@/lib/api";
import { ageInMonths } from "@/lib/ageUtils";
import { PIN_LENGTH, formatMiles, isValidPin } from "@/lib/parentSignIn";

const NAVY = "text-[#12386a] dark:text-slate-100";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function FamilyIcon({ className = "h-9 w-9" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="8" cy="5.5" r="3" />
      <path d="M3 21v-6.5A4.5 4.5 0 0 1 7.5 10h1A4.5 4.5 0 0 1 13 14.5V21z" />
      <circle cx="17" cy="10" r="2.4" />
      <path d="M13.5 21v-4a3.5 3.5 0 0 1 7 0v4z" />
    </svg>
  );
}

/**
 * Reads the device position once. Resolves { latitude, longitude } or rejects
 * with a message a parent can act on.
 */
function readPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device cannot share its location, so children cannot be signed in from it."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err?.code === 1) {
          reject(
            new Error(
              "Location access is turned off. Allow location for this site in your browser settings, then try again.",
            ),
          );
        } else {
          reject(new Error("We could not find your location. Please try again."));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function PinBoxes({ value, onChange, autoFocus, label }) {
  const refs = useRef([]);
  const digits = Array.from({ length: PIN_LENGTH }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setAt(index, digit) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, PIN_LENGTH));
  }

  function handleChange(index, raw) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setAt(index, "");
      return;
    }
    if (clean.length > 1) {
      // Pasted or autofilled: spread the digits from this box onward.
      const next = digits.slice();
      for (let i = 0; i < clean.length && index + i < PIN_LENGTH; i += 1) {
        next[index + i] = clean[i];
      }
      onChange(next.join("").slice(0, PIN_LENGTH));
      refs.current[Math.min(index + clean.length, PIN_LENGTH - 1)]?.focus();
      return;
    }
    setAt(index, clean);
    if (index < PIN_LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      setAt(index - 1, "");
      event.preventDefault();
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="password"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={PIN_LENGTH}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`${label} digit ${index + 1}`}
          className="h-12 w-10 rounded-lg border-2 border-slate-300 bg-white text-center text-xl font-black text-[#12386a] outline-none transition focus:border-[#1c5fa8] focus:ring-2 focus:ring-sky-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-sky-900 sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}

function ageMeta(child) {
  const months = ageInMonths(child.birthDate);
  const age =
    months === null || months < 0
      ? ""
      : months < 24
        ? `Age ${months} mo`
        : `Age ${Math.floor(months / 12)}`;
  return [age, child.classroomName].filter(Boolean).join("  |  ");
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function StatusCell({ child }) {
  if (child.status === "SIGNED_IN") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
        <div>
          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Signed In</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Today at {formatTime(child.statusAt)}</div>
        </div>
      </div>
    );
  }
  if (child.status === "SIGNED_OUT") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />
        <div>
          <div className="text-sm font-bold text-slate-600 dark:text-slate-300">Signed Out</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Today at {formatTime(child.statusAt)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
      <div>
        <div className="text-sm font-bold text-gray-600 dark:text-gray-300">Not Signed In</div>
        <div className="text-xs text-gray-400">—</div>
      </div>
    </div>
  );
}

function ChildAvatar({ child }) {
  if (child.photoUrl) {
    return (
      <img
        src={child.photoUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-600"
      />
    );
  }
  const initials = `${(child.firstName || "").slice(0, 1)}${(child.lastName || "").slice(0, 1)}`.toUpperCase();
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-black text-white">
      {initials || "C"}
    </span>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-2 text-center dark:border-sky-900 dark:bg-sky-950/40">
      <div className="whitespace-nowrap text-xs font-bold text-[#1c5fa8] dark:text-sky-300">
        {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
      <div className={"text-2xl font-black tracking-tight " + NAVY}>{formatTime(now)}</div>
    </div>
  );
}

function actionFor(child) {
  return child.status === "SIGNED_IN" ? "OUT" : "IN";
}

/**
 * Parent sign-in/out, in three steps:
 *   1. location  – the device must be within the center's geofence (1 mile by
 *                  default). Too far away stops here.
 *   2. pin       – enter the 6-digit PIN, or create one the first time.
 *   3. children  – sign each child in or out, singly or as a selection.
 * The PIN stays in memory only while the dialog is open; each sign-in request
 * resends it with a fresh location so the server can check both again.
 */
export default function SignInOutDialog({ onClose, onChanged }) {
  const [step, setStep] = useState("locating");
  const [error, setError] = useState("");
  const [farAway, setFarAway] = useState(null);
  const [position, setPosition] = useState(null);
  const [hasPin, setHasPin] = useState(true);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [children, setChildren] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [flash, setFlash] = useState("");
  const verifiedPin = useRef("");

  const checkLocation = useCallback(async () => {
    setStep("locating");
    setError("");
    setFarAway(null);
    try {
      const [coords, pinState] = await Promise.all([
        readPosition(),
        apiJson("/api/v1/parent-sign-in"),
      ]);
      const result = await apiJson("/api/v1/parent-sign-in/location", {
        method: "POST",
        body: JSON.stringify(coords),
      });
      setPosition(coords);
      setHasPin(!!pinState?.hasPin);
      if (result?.withinRange) {
        setStep("pin");
      } else {
        setFarAway(result || {});
        setStep("blocked");
      }
    } catch (e) {
      setError(e.message || "We could not check your location.");
      setStep("blocked");
    }
  }, []);

  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submitPin(event) {
    event.preventDefault();
    if (!isValidPin(pin)) {
      setError(`Enter all ${PIN_LENGTH} digits.`);
      return;
    }
    if (!hasPin && pin !== confirmPin) {
      setError("The PINs do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiJson("/api/v1/parent-sign-in/pin", {
        method: "POST",
        body: JSON.stringify(hasPin ? { pin } : { pin, confirmPin }),
      });
      verifiedPin.current = pin;
      setChildren(Array.isArray(data?.children) ? data.children : []);
      setStep("children");
    } catch (e) {
      setError(e.message || "That PIN did not work.");
      setPin("");
      setConfirmPin("");
    } finally {
      setBusy(false);
    }
  }

  async function record(changes) {
    if (!changes.length) return;
    setBusy(true);
    setError("");
    setFlash("");
    try {
      // Re-read the position so a parent cannot open the dialog at the center
      // and finish signing out after driving away.
      const coords = await readPosition().catch(() => position);
      setPosition(coords);
      const data = await apiJson("/api/v1/parent-sign-in", {
        method: "POST",
        body: JSON.stringify({ pin: verifiedPin.current, ...coords, changes }),
      });
      setChildren(Array.isArray(data?.children) ? data.children : []);
      setSelected(new Set());
      const at = data?.recordedAt ? formatTime(data.recordedAt) : "";
      const namesFor = (action) =>
        changes
          .filter((change) => change.action === action)
          .map((change) => children.find((child) => child.id === change.childId)?.firstName)
          .filter(Boolean)
          .join(", ");
      setFlash(
        [
          namesFor("IN") && `${namesFor("IN")} signed in at ${at}.`,
          namesFor("OUT") && `${namesFor("OUT")} signed out at ${at}.`,
        ]
          .filter(Boolean)
          .join(" "),
      );
      onChanged?.();
    } catch (e) {
      if (e.data?.code === "TOO_FAR") {
        setFarAway(e.data);
        setStep("blocked");
      } else {
        setError(e.message || "Could not record the sign-in.");
      }
    } finally {
      setBusy(false);
    }
  }

  const selectedChildren = useMemo(
    () => children.filter((child) => selected.has(child.id)),
    [children, selected],
  );
  const bulkLabel = useMemo(() => {
    if (!selectedChildren.length) return "Sign In Selected";
    const actions = new Set(selectedChildren.map(actionFor));
    if (actions.size > 1) return `Update ${selectedChildren.length} Selected`;
    return actions.has("OUT") ? "Sign Out Selected" : "Sign In Selected";
  }, [selectedChildren]);

  const allSelected = children.length > 0 && selected.size === children.length;

  function toggle(childId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  }

  const wide = step === "children";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sign Children In / Out"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          "relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 " +
          (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        {step === "locating" ? (
          <div className="px-6 py-10 text-center">
            <AmerisLogo size="md" showText={false} className="mx-auto" />
            <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-[#1c5fa8]" />
            <h2 className={"mt-4 text-lg font-black " + NAVY}>Checking your location…</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Children can only be signed in or out near the center.
            </p>
          </div>
        ) : null}

        {step === "blocked" ? (
          <div className="px-6 py-8 text-center">
            <AmerisLogo size="md" showText={false} className="mx-auto" />
            <div className="mx-auto mt-5 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
            </div>
            <h2 className={"mt-4 text-xl font-black " + NAVY}>
              {farAway?.code === "TOO_FAR" ? "You're too far away" : "Can't sign in from here"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
              {farAway?.code === "TOO_FAR" && farAway.distanceMeters != null ? (
                <>
                  You are about <strong>{formatMiles(farAway.distanceMeters)}</strong> from{" "}
                  {farAway.centerName || "the center"}. Children can only be signed in or out within{" "}
                  {formatMiles(farAway.radiusMeters)} of the center.
                </>
              ) : (
                farAway?.error || error || "Your location could not be confirmed."
              )}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={checkLocation}
                className="rounded-xl bg-[#12386a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0e2c54]"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : null}

        {step === "pin" ? (
          <form onSubmit={submitPin} className="px-6 py-8 text-center">
            <AmerisLogo size="md" showText={false} className="mx-auto" />
            <h2 className={"mt-4 font-serif text-2xl font-black " + NAVY}>
              {hasPin ? "Enter Your PIN" : "Create Your PIN"}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {hasPin
                ? `Please enter your ${PIN_LENGTH} digit PIN to continue.`
                : `Choose a ${PIN_LENGTH} digit PIN. You will use it every time you sign your children in or out.`}
            </p>

            <div className="mt-5 space-y-4">
              <PinBoxes value={pin} onChange={setPin} autoFocus label={hasPin ? "PIN" : "New PIN"} />
              {!hasPin ? (
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Confirm PIN</div>
                  <PinBoxes value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" />
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || pin.length !== PIN_LENGTH || (!hasPin && confirmPin.length !== PIN_LENGTH)}
              className="mt-6 w-full rounded-xl bg-[#12386a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0e2c54] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Checking…" : hasPin ? "Continue" : "Save PIN & Continue"}
            </button>
          </form>
        ) : null}

        {step === "children" ? (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AmerisLogo size="sm" showText={false} />
                <h2 className={"text-lg font-black tracking-tight sm:whitespace-nowrap sm:text-xl " + NAVY}>
                  Sign Children In / Out
                </h2>
              </div>
              <LiveClock />
            </div>

            {flash ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300" role="status">
                {flash}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">
                {error}
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-200 bg-sky-50 px-3 py-2 text-xs font-bold text-[#12386a] dark:border-gray-700 dark:bg-gray-900/60 dark:text-sky-200 sm:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(children.map((child) => child.id)))
                  }
                  aria-label="Select all children"
                  disabled={!children.length}
                />
                <span>Child</span>
                <span className="hidden sm:block">Current Status</span>
                <span className="text-center">Action</span>
              </div>

              {children.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No children are linked to this account.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {children.map((child) => {
                    const signOut = actionFor(child) === "OUT";
                    return (
                      <li
                        key={child.id}
                        className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_7rem]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={selected.has(child.id)}
                          onChange={() => toggle(child.id)}
                          aria-label={`Select ${child.firstName}`}
                        />
                        <div className="flex min-w-0 items-center gap-3">
                          <ChildAvatar child={child} />
                          <div className="min-w-0">
                            <div className={"truncate text-sm font-bold " + NAVY}>
                              {[child.firstName, child.lastName].filter(Boolean).join(" ")}
                            </div>
                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{ageMeta(child)}</div>
                            <div className="mt-1 sm:hidden">
                              <StatusCell child={child} />
                            </div>
                          </div>
                        </div>
                        <div className="hidden sm:block">
                          <StatusCell child={child} />
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => record([{ childId: child.id, action: actionFor(child) }])}
                          className={
                            "rounded-lg px-3 py-2 text-sm font-bold transition disabled:opacity-50 " +
                            (signOut
                              ? "border border-rose-400 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-blue-600 text-white hover:bg-blue-700")
                          }
                        >
                          {signOut ? "Sign Out" : "Sign In"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-[#12386a] dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1c5fa8] text-xs font-black text-white">i</span>
              The time will be recorded for all selected children.
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border-2 border-[#12386a] px-4 py-2.5 text-sm font-bold text-[#12386a] transition hover:bg-sky-50 dark:border-sky-300 dark:text-sky-200 dark:hover:bg-gray-700"
              >
                {flash ? "Done" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={busy || !selectedChildren.length}
                onClick={() =>
                  record(selectedChildren.map((child) => ({ childId: child.id, action: actionFor(child) })))
                }
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-900"
              >
                {busy ? "Recording…" : bulkLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
