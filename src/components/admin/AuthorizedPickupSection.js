import { apiJson } from "@/lib/api";
import { pickupPersonName } from "@/lib/personNames";
import { useEffect, useState } from "react";

// Authorized Pickup on Edit Child (client request 2026-10-02): people allowed
// to pick this child up, each with their own kiosk PIN. Changes save straight
// away; they are not part of the Edit Child form's Save. Rendered inside that
// form, so every button is type="button" and Enter never submits it.

function blockEnter(e) {
  if (e.key === "Enter") e.preventDefault();
}

function pinSummary(status) {
  if (status?.registrationPending) return "Registration number issued";
  if (status?.hasPin) return "PIN set";
  return "No PIN yet";
}

export default function AuthorizedPickupSection({ childId, centerId, otherChildren = [] }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [newPerson, setNewPerson] = useState({ firstName: "", middleInitial: "", lastName: "", phone: "" });
  const [copyFrom, setCopyFrom] = useState("");
  const [issuedCode, setIssuedCode] = useState(null); // { personId, code, expiresAt }

  const listUrl = `/api/v1/children/${encodeURIComponent(childId)}/pickup-people`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiJson(listUrl)
      .then((data) => !cancelled && setPeople(Array.isArray(data) ? data : []))
      .catch((e) => !cancelled && setError(e.message || "Failed to load authorized pickups"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [listUrl]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !centerId) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      apiJson(`/api/v1/pickup-people?centerId=${encodeURIComponent(centerId)}&q=${encodeURIComponent(q)}`)
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, centerId]);

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      const data = await action();
      if (Array.isArray(data)) setPeople(data);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const addExisting = (personId) =>
    run(async () => {
      const data = await apiJson(listUrl, { method: "POST", body: JSON.stringify({ pickupPersonId: personId }) });
      setQuery("");
      setResults([]);
      return data;
    });

  const addNew = () =>
    run(async () => {
      const data = await apiJson(listUrl, { method: "POST", body: JSON.stringify(newPerson) });
      setNewPerson({ firstName: "", middleInitial: "", lastName: "", phone: "" });
      return data;
    });

  const copyList = () =>
    run(async () => {
      const data = await apiJson(listUrl, { method: "POST", body: JSON.stringify({ copyFromChildId: copyFrom }) });
      setCopyFrom("");
      return data;
    });

  const remove = (person) => {
    if (!confirm(`Remove ${pickupPersonName(person)} from this child's authorized pickups?`)) return;
    run(() => apiJson(`${listUrl}?pickupPersonId=${encodeURIComponent(person.id)}`, { method: "DELETE" }));
  };

  const resetPin = (person) =>
    run(async () => {
      const result = await apiJson(`/api/v1/pickup-people/${encodeURIComponent(person.id)}/pin-reset`, { method: "POST" });
      setIssuedCode({ personId: person.id, ...result });
      return apiJson(listUrl);
    });

  const listedIds = new Set(people.map((p) => p.id));
  const canAddNew = newPerson.firstName.trim() && newPerson.middleInitial.trim() && newPerson.lastName.trim();

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🚸</span>
        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--admin-text)" }}>Authorized Pickup</span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--admin-text-muted)" }}>
        People allowed to pick up this child. Each one signs in and out at the kiosk with their own PIN.
        Changes here save immediately.
      </p>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={boxStyle}>
        <div style={labelStyle}>Search for existing person</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={blockEnter}
          placeholder="Search by first name, last name, or phone number..."
          style={inputStyle}
        />
        {results.length ? (
          <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
            {results.map((person) => (
              <div key={person.id} style={rowStyle}>
                <span style={{ flex: 1 }}>
                  {pickupPersonName(person)}
                  {person.phone ? <span style={mutedStyle}> · {person.phone}</span> : null}
                </span>
                {listedIds.has(person.id) ? (
                  <span style={mutedStyle}>Already listed</span>
                ) : (
                  <button type="button" style={smallButton} disabled={busy} onClick={() => addExisting(person.id)}>
                    Select
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ ...labelStyle, marginTop: 14 }}>Or add a new person</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 1fr auto", gap: 8, alignItems: "center" }}>
          <input
            aria-label="First name"
            placeholder="First name"
            value={newPerson.firstName}
            onChange={(e) => setNewPerson({ ...newPerson, firstName: e.target.value })}
            onKeyDown={blockEnter}
            style={inputStyle}
          />
          <input
            aria-label="Middle initial"
            placeholder="MI"
            maxLength={1}
            value={newPerson.middleInitial}
            onChange={(e) =>
              setNewPerson({ ...newPerson, middleInitial: e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase() })
            }
            onKeyDown={blockEnter}
            style={inputStyle}
          />
          <input
            aria-label="Last name"
            placeholder="Last name"
            value={newPerson.lastName}
            onChange={(e) => setNewPerson({ ...newPerson, lastName: e.target.value })}
            onKeyDown={blockEnter}
            style={inputStyle}
          />
          <input
            aria-label="Phone (optional)"
            placeholder="Phone (optional)"
            value={newPerson.phone}
            onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
            onKeyDown={blockEnter}
            style={inputStyle}
          />
          <button type="button" style={primaryButton} disabled={busy || !canAddNew} onClick={addNew}>
            + Add Person
          </button>
        </div>
      </div>

      <div style={{ ...labelStyle, marginTop: 14 }}>Authorized pickup list</div>
      {loading ? (
        <div style={mutedStyle}>Loading...</div>
      ) : people.length === 0 ? (
        <div style={{ ...mutedStyle, padding: "8px 0" }}>No one added yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {people.map((person) => (
            <div key={person.id}>
              <div style={rowStyle}>
                <span style={{ flex: 1, fontWeight: 600 }}>
                  {pickupPersonName(person)}
                  {person.phone ? <span style={mutedStyle}> · {person.phone}</span> : null}
                </span>
                <span style={mutedStyle}>{pinSummary(person.pinStatus)}</span>
                <button type="button" style={smallButton} disabled={busy} onClick={() => resetPin(person)}>
                  Reset PIN
                </button>
                <button type="button" style={dangerButton} disabled={busy} onClick={() => remove(person)} title="Remove">
                  Remove
                </button>
              </div>
              {issuedCode?.personId === person.id ? (
                <div style={codeStyle}>
                  Registration number <strong style={{ letterSpacing: "0.25em", fontSize: 18 }}>{issuedCode.code}</strong>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Take this number to the kiosk: they tap Register, enter it, and choose their PIN. It works once,
                    expires {new Date(issuedCode.expiresAt).toLocaleDateString()}, and will not be shown again.
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {otherChildren.length ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 220 }}>
            <option value="">Copy from another child...</option>
            {otherChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {[child.firstName, child.lastName].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
          <button type="button" style={smallButton} disabled={busy || !copyFrom} onClick={copyList}>
            Copy list
          </button>
        </div>
      ) : null}
    </div>
  );
}

const boxStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg-secondary)",
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: "var(--admin-text-secondary)", marginBottom: 6 };
const mutedStyle = { fontSize: 12, color: "var(--admin-text-muted)" };
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  fontSize: 13,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  boxSizing: "border-box",
};
const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  fontSize: 13,
  color: "var(--admin-text)",
};
const smallButton = {
  padding: "5px 10px",
  borderRadius: 8,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const dangerButton = { ...smallButton, color: "#b91c1c", borderColor: "#fecaca" };
const primaryButton = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const errorStyle = {
  marginBottom: 10,
  padding: "8px 12px",
  borderRadius: 8,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
};
const codeStyle = {
  margin: "4px 0 2px",
  padding: "8px 12px",
  borderRadius: 10,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
  fontSize: 13,
};
