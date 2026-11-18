import {
  formatKioskDate,
  formatKioskTime,
  Keypad,
  KioskButton,
  KioskError,
  KioskFrame,
  KioskTitle,
  NAVY,
  PIN_LENGTH,
  PinBoxes,
} from "@/components/kiosk/KioskUI";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// Front-desk kiosk (client request 2026-10-02). Stays open on an enrolled
// tablet with nobody signed in. Screens follow the client's mockups:
// Front Screen #1 (PIN) -> #2 (Employee or Parent) -> Employee Screen #1/#2
// (clock in/out) or Parent Screen #1/#2 (sign children in/out), plus Register
// PIN Screens #1-#4 for setting a PIN from an admin's registration number.

const IDLE_MS = 45 * 1000;

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Something went wrong. Please try again.");
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export default function KioskPage() {
  const [device, setDevice] = useState(null); // null = loading
  const [screen, setScreen] = useState("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState(null); // identify response
  const [done, setDone] = useState(null); // { kind, action, at }
  // Staff who also have children here stay on their screen after clocking in
  // or out, so they can sign their children in without their PIN again
  // (client sheet 10-29 (9), row 9). { action, at }
  const [clocked, setClocked] = useState(null);
  const [selected, setSelected] = useState([]);
  const [registration, setRegistration] = useState({ code: "", name: "", pin: "" });
  const idleTimer = useRef(null);

  useEffect(() => {
    fetch("/api/v1/kiosk/device")
      .then((r) => r.json())
      .then(setDevice)
      .catch(() => setDevice({ enrolled: false }));
  }, []);

  const resetToStart = useCallback(() => {
    setScreen("pin");
    setPin("");
    setError("");
    setBusy(false);
    setPerson(null);
    setDone(null);
    setSelected([]);
    setClocked(null);
    setRegistration({ code: "", name: "", pin: "" });
  }, []);

  // Return to the PIN screen after a period without touches.
  useEffect(() => {
    if (screen === "pin") return undefined;
    const arm = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(resetToStart, IDLE_MS);
    };
    arm();
    const events = ["pointerdown", "keydown"];
    events.forEach((e) => window.addEventListener(e, arm));
    return () => {
      clearTimeout(idleTimer.current);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [screen, resetToStart]);

  function goTo(next) {
    setError("");
    setScreen(next);
  }

  async function submitPin() {
    if (pin.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/v1/kiosk/identify", { pin });
      setPerson(data);
      setPin("");
      if (data.employee && data.parent) goTo("choose");
      else goTo(data.employee ? "employee" : "parent");
    } catch (e) {
      setError(e.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function clock(action) {
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/v1/kiosk/clock", { token: person.token, action });
      const at = new Date(data.at);
      if (person.parent) {
        setPerson((current) => ({
          ...current,
          employee:
            action === "in"
              ? { ...current.employee, clockedIn: true, clockIn: at.toISOString() }
              : { ...current.employee, clockedIn: false, clockOut: at.toISOString() },
        }));
        setClocked({ action, at });
        return;
      }
      setDone({ kind: "employee", action, at });
      goTo("done");
    } catch (e) {
      setError(e.message);
      if (e.status === 401) setTimeout(resetToStart, 2500);
    } finally {
      setBusy(false);
    }
  }

  /** Signs the picked children in and/or out, then shows the done screen. */
  async function signSelected(inIds, outIds) {
    setBusy(true);
    setError("");
    try {
      let data = null;
      if (inIds.length) data = await post("/api/v1/kiosk/children", { token: person.token, childIds: inIds, action: "in" });
      if (outIds.length) data = await post("/api/v1/kiosk/children", { token: person.token, childIds: outIds, action: "out" });
      setPerson((current) => ({ ...current, parent: { children: data.children } }));
      setSelected([]);
      setDone({ kind: "parent", action: inIds.length && outIds.length ? "both" : inIds.length ? "in" : "out", at: new Date(data.at) });
      goTo("done");
    } catch (e) {
      setError(e.message);
      if (e.status === 401) setTimeout(resetToStart, 2500);
    } finally {
      setBusy(false);
    }
  }

  async function checkRegistrationCode() {
    if (registration.code.length !== PIN_LENGTH || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await post("/api/v1/kiosk/register/check", { code: registration.code });
      setRegistration((r) => ({ ...r, name: data.name }));
      goTo("register-pin");
    } catch (e) {
      setError(e.message);
      setRegistration((r) => ({ ...r, code: "" }));
    } finally {
      setBusy(false);
    }
  }

  async function completeRegistration() {
    if (pin.length !== PIN_LENGTH || busy) return;
    if (pin !== registration.pin) {
      setError("The PINs did not match. Please choose your PIN again.");
      setPin("");
      setRegistration((r) => ({ ...r, pin: "" }));
      setScreen("register-pin");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/api/v1/kiosk/register/complete", { code: registration.code, pin });
      setPin("");
      goTo("register-done");
    } catch (e) {
      setError(e.message);
      setPin("");
      if (e.data?.code === "PIN_TAKEN") {
        setRegistration((r) => ({ ...r, pin: "" }));
        setScreen("register-pin");
      } else if (e.data?.code === "INVALID_CODE") {
        setTimeout(resetToStart, 3000);
      }
    } finally {
      setBusy(false);
    }
  }

  if (device === null) {
    return <KioskFrame showClock={false}><div className="text-xl text-gray-500">Loading...</div></KioskFrame>;
  }

  if (!device.enrolled) {
    return (
      <KioskFrame showClock={false}>
        <KioskTitle subtitle="This device is not set up as a kiosk.">Kiosk</KioskTitle>
        <p className="mt-6 max-w-lg text-center text-lg text-gray-600">
          An administrator can turn this tablet into the front desk kiosk for a center.
        </p>
        <Link href="/kiosk/setup" className="mt-6">
          <KioskButton>Set up this kiosk</KioskButton>
        </Link>
      </KioskFrame>
    );
  }

  if (screen === "pin") {
    return (
      <KioskFrame>
        <KioskTitle subtitle="Enter your PIN">Welcome</KioskTitle>
        <PinBoxes value={pin} />
        <Keypad value={pin} onChange={(v) => { setError(""); setPin(v); }} onEnter={submitPin} disabled={busy} />
        <KioskError message={error} />
        <div className="mt-8 flex w-full max-w-3xl items-center justify-between gap-4">
          <KioskButton variant="secondary" onClick={() => { setPin(""); setError(""); }}>&#10005; Clear</KioskButton>
          <div className="flex gap-4">
            <KioskButton variant="secondary" onClick={() => { setPin(""); goTo("register-code"); }}>Register</KioskButton>
            <KioskButton onClick={submitPin} disabled={busy || pin.length !== PIN_LENGTH}>
              {busy ? "Checking..." : "Enter ›"}
            </KioskButton>
          </div>
        </div>
        <div className="mt-6 text-sm text-gray-400">{device.center?.name}</div>
      </KioskFrame>
    );
  }

  if (screen === "choose") {
    return (
      <KioskFrame showClock={false}>
        <h1 className={`font-serif text-5xl font-black ${NAVY}`}>How are you signing in today?</h1>
        <div className="mt-10 grid grid-cols-2 gap-8">
          <ChoiceCard label="Employee" icon="person" onClick={() => goTo("employee")} />
          <ChoiceCard label="Parent" icon="family" onClick={() => goTo("parent")} />
        </div>
        <BackRow onBack={resetToStart} />
      </KioskFrame>
    );
  }

  if (screen === "employee") {
    const status = person.employee;
    const since = status.clockedIn ? status.clockIn : status.clockOut;
    return (
      <KioskFrame>
        <div className="text-2xl font-bold text-[#1e4b8f]">Hello, {person.name}</div>
        <div className="mt-6 flex w-full max-w-3xl items-center gap-8 rounded-2xl border border-sky-200 bg-sky-50/80 px-10 py-7">
          <span className={`text-6xl ${NAVY}`} aria-hidden="true">&#128339;</span>
          <div className="border-l border-sky-200 pl-8">
            <div className={`text-4xl font-black ${NAVY}`}>{status.clockedIn ? "Currently Clocked In" : "Currently Clocked Out"}</div>
            {since ? (
              <div className="mt-1 text-lg text-[#1e4b8f]">
                as of {formatKioskTime(new Date(since))} on {formatKioskDate(new Date(since))}
              </div>
            ) : (
              <div className="mt-1 text-lg text-[#1e4b8f]">No clock-in yet today</div>
            )}
          </div>
        </div>
        <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-6">
          <KioskButton variant="success" className="py-8 text-3xl" disabled={busy || status.clockedIn} onClick={() => clock("in")}>
            &#10148; Clock In
          </KioskButton>
          <KioskButton variant="danger" className="py-8 text-3xl" disabled={busy || !status.clockedIn} onClick={() => clock("out")}>
            Clock Out &#10148;
          </KioskButton>
        </div>
        {clocked ? (
          <div role="status" className="mt-6 w-full max-w-3xl rounded-2xl border border-green-200 bg-green-50 px-8 py-4 text-center text-xl font-bold text-green-800">
            {clocked.action === "in" ? "You’re Clocked In" : "You’re Clocked Out"} at {formatKioskTime(clocked.at)}
          </div>
        ) : null}
        <KioskError message={error} />
        {person.parent ? (
          <div className="mt-6 grid w-full max-w-3xl grid-cols-2 gap-6">
            <KioskButton variant="secondary" onClick={clocked ? resetToStart : () => goTo("choose")}>
              {clocked ? "Done" : "‹ Back"}
            </KioskButton>
            <KioskButton onClick={() => goTo("parent")}>Sign My Children In / Out ›</KioskButton>
          </div>
        ) : (
          <BackRow onBack={resetToStart} />
        )}
      </KioskFrame>
    );
  }

  if (screen === "parent") {
    const kids = person.parent?.children || [];
    // Client sheet 10-29 (9), row 8: no check boxes. Tapping a child's Sign In
    // (or Sign Out) button picks them without leaving this screen; tapping it
    // again un-picks them. The button at the bottom then signs every picked
    // child in (or out) at once.
    const selectedKids = kids.filter((k) => selected.includes(k.id));
    const inIds = selectedKids.filter((k) => !k.signedIn).map((k) => k.id);
    const outIds = selectedKids.filter((k) => k.signedIn).map((k) => k.id);
    const bulkLabel = inIds.length && outIds.length ? "Sign In / Out Selected" : outIds.length ? "Sign Out Selected" : "Sign In Selected";
    const allSelected = kids.length > 0 && selected.length === kids.length;
    const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    return (
      <KioskFrame showClock={false} topLeft={null}>
        <div className="flex w-full max-w-4xl items-end justify-between">
          <h1 className={`font-serif text-4xl font-black ${NAVY}`}>Sign Children In / Out</h1>
          <div className="text-lg font-semibold text-[#1e4b8f]">{person.name}</div>
        </div>
        <div className="mt-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_150px_170px] lg:grid-cols-[minmax(0,1fr)_220px_200px] items-center bg-sky-50 px-4 py-3 text-base font-bold text-[#0b2f6b]">
            <span>Child</span>
            <span>Current Status</span>
            <button type="button" className="justify-self-start text-left text-sm font-bold text-[#1d5fd1] underline" onClick={() => setSelected(allSelected ? [] : kids.map((k) => k.id))}>
              {allSelected ? "Clear All" : "Select All"}
            </button>
          </div>
          {kids.map((kid) => (
            <div key={kid.id} className={`grid grid-cols-[minmax(0,1fr)_150px_170px] lg:grid-cols-[minmax(0,1fr)_220px_200px] items-center border-t border-sky-100 px-4 py-3 ${selected.includes(kid.id) ? "bg-sky-50" : ""}`}>
              <div className="flex min-w-0 items-center gap-3 lg:gap-4">
                {kid.photoUrl ? (
                  <img src={kid.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover lg:h-14 lg:w-14" />
                ) : (
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xl font-black lg:h-14 lg:w-14 ${NAVY}`}>
                    {kid.firstName?.[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <div className={`truncate text-xl font-bold ${NAVY}`}>{kid.firstName}</div>
                  <div className="truncate text-sm text-[#1e4b8f]">
                    {[kid.age ? `Age ${kid.age}` : null, kid.classroom].filter(Boolean).join(" | ")}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-3 w-3 rounded-full ${kid.signedIn ? "bg-green-500" : "bg-gray-400"}`} />
                <div>
                  <div className={`font-semibold ${kid.signedIn ? "text-green-700" : "text-gray-600"}`}>
                    {kid.signedIn ? "Signed In" : kid.checkedOutAt ? "Signed Out" : "Not Signed In"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {kid.signedIn
                      ? `Today at ${formatKioskTime(new Date(kid.checkedInAt))}`
                      : kid.checkedOutAt
                        ? `Today at ${formatKioskTime(new Date(kid.checkedOutAt))}`
                        : "—"}
                  </div>
                </div>
              </div>
              <KioskButton
                variant={selected.includes(kid.id) ? "success" : kid.signedIn ? "danger" : "primary"}
                className="px-4 py-2.5 text-base"
                disabled={busy}
                aria-pressed={selected.includes(kid.id)}
                aria-label={`${kid.signedIn ? "Sign Out" : "Sign In"} ${kid.firstName}`}
                onClick={() => toggle(kid.id)}
              >
                {selected.includes(kid.id) ? (kid.signedIn ? "✓ Signing Out" : "✓ Signing In") : kid.signedIn ? "Sign Out" : "Sign In"}
              </KioskButton>
            </div>
          ))}
        </div>
        <div className="mt-4 w-full max-w-4xl rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 text-[#1e4b8f]">
          &#9432; Tap Sign In (or Sign Out) for each child, then tap the button below. The time will be recorded for all selected children.
        </div>
        <KioskError message={error} />
        <div className="mt-6 grid w-full max-w-4xl grid-cols-2 gap-6">
          <KioskButton variant="secondary" onClick={() => (person.employee ? goTo("choose") : resetToStart())}>
            Cancel
          </KioskButton>
          <KioskButton disabled={busy || !selectedKids.length} onClick={() => signSelected(inIds, outIds)}>
            {busy ? "Saving..." : bulkLabel}
          </KioskButton>
        </div>
      </KioskFrame>
    );
  }

  if (screen === "done") {
    const message =
      done.kind === "employee"
        ? done.action === "in" ? "You’re Clocked In" : "You’re Clocked Out"
        : done.action === "in"
          ? "Your child(ren) have been successfully signed in."
          : done.action === "both"
            ? "Your child(ren) have been successfully signed in and out."
            : "Your child(ren) have been successfully signed out.";
    return (
      <KioskFrame>
        <h1 className={`max-w-2xl text-center font-serif text-5xl font-black leading-tight ${NAVY}`}>{message}</h1>
        <div className="mt-8 rounded-2xl border border-sky-200 bg-sky-50/80 px-12 py-5 text-center">
          <div className="text-2xl text-[#1e4b8f]">{formatKioskDate(done.at)}</div>
          <div className={`text-6xl font-black ${NAVY}`}>{formatKioskTime(done.at)}</div>
        </div>
        <KioskButton className="mt-10 min-w-[280px]" onClick={resetToStart}>Done</KioskButton>
      </KioskFrame>
    );
  }

  if (screen === "register-code") {
    return (
      <KioskFrame>
        <KioskTitle subtitle="Enter a 6-digit registration number">Register Your PIN</KioskTitle>
        <PinBoxes value={registration.code} />
        <Keypad
          value={registration.code}
          onChange={(v) => { setError(""); setRegistration((r) => ({ ...r, code: v })); }}
          onEnter={checkRegistrationCode}
          disabled={busy}
        />
        <KioskError message={error} />
        <div className="mt-8 flex w-full max-w-3xl justify-between">
          <KioskButton variant="secondary" onClick={resetToStart}>&#10005; Cancel</KioskButton>
          <KioskButton onClick={checkRegistrationCode} disabled={busy || registration.code.length !== PIN_LENGTH}>
            Next &#8250;
          </KioskButton>
        </div>
      </KioskFrame>
    );
  }

  if (screen === "register-pin" || screen === "register-confirm") {
    const confirming = screen === "register-confirm";
    const next = () => {
      if (pin.length !== PIN_LENGTH) return;
      if (confirming) completeRegistration();
      else {
        setRegistration((r) => ({ ...r, pin }));
        setPin("");
        goTo("register-confirm");
      }
    };
    return (
      <KioskFrame>
        {confirming ? (
          <KioskTitle subtitle="Please re-enter your 6-digit PIN to verify.">Enter your PIN again</KioskTitle>
        ) : (
          <>
            <KioskTitle>Welcome {registration.name}!</KioskTitle>
            <div className="mt-3 text-lg text-[#1e4b8f]">If this is not you, press Cancel.</div>
            <div className="mt-2 text-xl font-semibold text-[#1e4b8f]">Enter your 6-digit PIN</div>
          </>
        )}
        <PinBoxes value={pin} />
        <Keypad value={pin} onChange={(v) => { setError(""); setPin(v); }} onEnter={next} disabled={busy} />
        <KioskError message={error} />
        <div className="mt-8 flex w-full max-w-3xl items-center justify-between">
          <div className="flex gap-4">
            <KioskButton variant="secondary" onClick={() => setPin("")}>&#10005; Clear</KioskButton>
            <KioskButton variant="danger" onClick={resetToStart}>&#10005; Cancel</KioskButton>
          </div>
          <KioskButton onClick={next} disabled={busy || pin.length !== PIN_LENGTH}>Enter &#8250;</KioskButton>
        </div>
      </KioskFrame>
    );
  }

  if (screen === "register-done") {
    return (
      <KioskFrame>
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-green-100">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-6xl text-white">&#10003;</div>
        </div>
        <div className="mt-6"><KioskTitle subtitle="Your PIN has been successfully registered.">Registration Complete!</KioskTitle></div>
        <KioskButton className="mt-10 min-w-[260px]" onClick={resetToStart}>Continue &#8250;</KioskButton>
      </KioskFrame>
    );
  }

  return null;
}

function ChoiceCard({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-60 w-72 flex-col items-center justify-center gap-5 rounded-2xl border-2 border-sky-200 bg-sky-50 shadow-sm transition hover:border-sky-400 active:bg-sky-100"
    >
      <span className="text-8xl text-[#1d5fd1]" aria-hidden="true">{icon === "family" ? "\u{1F46A}" : "\u{1F464}"}</span>
      <span className={`text-4xl font-bold ${NAVY}`}>{label}</span>
    </button>
  );
}

function BackRow({ onBack }) {
  return (
    <div className="mt-10 flex w-full max-w-3xl">
      <KioskButton variant="secondary" onClick={onBack}>&#8249; Back</KioskButton>
    </div>
  );
}

KioskPage.noPortalShell = true;
