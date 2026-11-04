import { KioskButton, KioskFrame, NAVY } from "@/components/kiosk/KioskUI";
import { apiJson } from "@/lib/api";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Admin turns the tablet they are using into a center's front-desk kiosk. The
// browser then keeps a long-lived device cookie, so the kiosk works without
// anyone staying signed in. Lost or replaced tablets can be revoked here.
export default function KioskSetupPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [centers, setCenters] = useState([]);
  const [devices, setDevices] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [name, setName] = useState("Front desk kiosk");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enrolled, setEnrolled] = useState(null);
  // An enrolled kiosk picked from the list shows at the top with Open (client request 2026-10-29).
  const [picked, setPicked] = useState(null);
  const router = useRouter();

  async function openPicked() {
    if (picked.isThisDevice) return router.push("/kiosk");
    if (!confirm(`Open "${picked.name}" on this tablet? The tablet using it now will need to be set up again.`)) return;
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/v1/kiosk/devices?id=${encodeURIComponent(picked.id)}`, { method: "PATCH" });
      router.push("/kiosk");
    } catch (e) {
      setError(e.message || "Could not open the kiosk");
      setBusy(false);
    }
  }

  async function loadDevices() {
    setDevices(await apiJson("/api/v1/kiosk/devices"));
  }

  useEffect(() => {
    if (!isAdmin) return;
    apiJson("/api/v1/centers")
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      })
      .catch((e) => setError(e.message));
    loadDevices().catch((e) => setError(e.message));
  }, [isAdmin]);

  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const result = await apiJson("/api/v1/kiosk/devices", {
        method: "POST",
        body: JSON.stringify({ centerId, name }),
      });
      setEnrolled(result);
      await loadDevices();
    } catch (e) {
      setError(e.message || "Could not set up this kiosk");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(device) {
    if (!confirm(`Stop "${device.name}" (${device.center?.name}) from working as a kiosk?`)) return;
    setError("");
    try {
      await apiJson(`/api/v1/kiosk/devices?id=${encodeURIComponent(device.id)}`, { method: "DELETE" });
      if (device.isThisDevice) setEnrolled(null);
      await loadDevices();
    } catch (e) {
      setError(e.message || "Could not revoke the kiosk");
    }
  }

  if (status === "loading") {
    return <KioskFrame showClock={false}><div className="text-gray-500">Loading...</div></KioskFrame>;
  }

  if (!isAdmin) {
    return (
      <KioskFrame showClock={false}>
        <h1 className={`font-serif text-4xl font-black ${NAVY}`}>Kiosk setup</h1>
        <p className="mt-4 max-w-md text-center text-lg text-gray-600">
          Sign in with an administrator account on this tablet to set it up as a kiosk.
        </p>
        <Link href="/login?callbackUrl=%2Fkiosk%2Fsetup" className="mt-6">
          <KioskButton>Sign in</KioskButton>
        </Link>
      </KioskFrame>
    );
  }

  const thisDevice = devices.find((d) => d.isThisDevice);

  return (
    <KioskFrame showClock={false}>
      <h1 className={`font-serif text-4xl font-black ${NAVY}`}>Kiosk setup</h1>
      {picked ? (
        <div className="mt-6 flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5 shadow-sm">
          <div>
            <div className={`text-lg font-black ${NAVY}`}>{picked.name}</div>
            <div className="text-sm text-gray-600">{picked.center?.name}{picked.isThisDevice ? " · this tablet" : ""}</div>
          </div>
          <div className="flex gap-2">
            <KioskButton onClick={openPicked} disabled={busy}>Open kiosk</KioskButton>
            <button type="button" onClick={() => setPicked(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">Close</button>
          </div>
        </div>
      ) : null}
      <div className="mt-6 w-full max-w-xl rounded-2xl border border-sky-200 bg-white p-6 shadow-sm">
        {enrolled || thisDevice ? (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
            This tablet is the kiosk for <strong>{(enrolled || thisDevice).center?.name}</strong>.
            You can sign out of your account; the kiosk keeps working.
          </div>
        ) : null}
        <label className="block text-sm font-bold text-gray-700">
          Center
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
          >
            <option value="">Choose a center...</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm font-bold text-gray-700">
          Name for this tablet
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
            maxLength={80}
          />
        </label>
        {error ? <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <KioskButton onClick={enroll} disabled={busy || !centerId}>
            {thisDevice ? "Set up again" : "Turn this tablet into a kiosk"}
          </KioskButton>
          {enrolled || thisDevice ? (
            <Link href="/kiosk"><KioskButton variant="secondary">Open kiosk</KioskButton></Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8 w-full max-w-xl">
        <h2 className={`text-xl font-bold ${NAVY}`}>Enrolled kiosks</h2>
        {devices.length === 0 ? (
          <p className="mt-2 text-gray-500">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {devices.map((d) => (
              <li key={d.id} className={`flex items-center justify-between rounded-xl border bg-white px-4 py-3 ${picked?.id === d.id ? "border-blue-400 ring-2 ring-blue-200" : "border-sky-100"}`}>
                <button type="button" onClick={() => { setPicked(d); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-w-0 flex-1 text-left" title="Show this kiosk at the top to open it">
                  <div className="font-semibold text-gray-900">
                    {d.name} {d.isThisDevice ? <span className="text-sm text-green-700">(this tablet)</span> : null}
                  </div>
                  <div className="text-sm text-gray-500">
                    {d.center?.name} · last used {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "never"}
                  </div>
                </button>
                <button type="button" onClick={() => revoke(d)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </KioskFrame>
  );
}

KioskSetupPage.noPortalShell = true;
