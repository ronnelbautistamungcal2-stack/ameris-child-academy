import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

const CHILD_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name" },
  { key: "birthDate", label: "Birth Date" },
  { key: "parentEmail", label: "Parent Email" },
  { key: "emergencyContact", label: "Emergency Contact" },
  { key: "allergies", label: "Allergies" },
];

export default function DataImport() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 - file
  const [fileType, setFileType] = useState(null); // "excel" | "pdf"
  const [pdfUrl, setPdfUrl] = useState(null);

  // Step 2 - parsed data
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [columnMap, setColumnMap] = useState({});

  // Step 3 - import
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    apiJson("/api/v1/centers").then((c) => setCenters(Array.isArray(c) ? c : [])).catch(() => {});
    apiJson("/api/v1/classes").then((c) => setClasses(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = String(reader.result || "");
        const idx = result.indexOf(",");
        if (idx === -1) return reject(new Error("Invalid file encoding"));
        resolve(result.slice(idx + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";

    try {
      const dataBase64 = await fileToBase64(file);

      if (isPdf) {
        // Upload PDF directly
        const uploaded = await apiJson("/api/v1/uploads", {
          method: "POST",
          body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
        });
        setPdfUrl(uploaded.url);
        setFileType("pdf");
        setSuccess(`PDF uploaded: ${uploaded.originalName || file.name}`);
      } else {
        // Parse Excel
        const result = await apiJson("/api/v1/import/parse-excel", {
          method: "POST",
          body: JSON.stringify({ dataBase64 }),
        });
        setSheets(result.sheets || []);
        setSelectedSheet(0);
        setFileType("excel");

        // Auto-map columns
        if (result.sheets?.[0]?.headers) {
          autoMapColumns(result.sheets[0].headers);
        }
        setStep(2);
      }
    } catch (err) {
      setError(err.message || "Failed to process file");
    } finally {
      setLoading(false);
    }
  }

  function autoMapColumns(headers) {
    const map = {};
    const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
    for (const field of CHILD_FIELDS) {
      const key = field.key.toLowerCase();
      let idx = lower.findIndex((h) => h === key);
      if (idx === -1) idx = lower.findIndex((h) => h.includes(key));
      if (idx === -1 && key === "firstname") idx = lower.findIndex((h) => h.includes("first"));
      if (idx === -1 && key === "lastname") idx = lower.findIndex((h) => h.includes("last"));
      if (idx === -1 && key === "birthdate") idx = lower.findIndex((h) => h.includes("birth") || h.includes("dob") || h.includes("dateofbirth"));
      if (idx === -1 && key === "parentemail") idx = lower.findIndex((h) => h.includes("parent") || h.includes("email"));
      if (idx === -1 && key === "emergencycontact") idx = lower.findIndex((h) => h.includes("emergency"));
      if (idx === -1 && key === "allergies") idx = lower.findIndex((h) => h.includes("allerg"));
      if (idx >= 0) map[field.key] = idx;
    }
    setColumnMap(map);
  }

  function handleSheetChange(idx) {
    setSelectedSheet(idx);
    if (sheets[idx]?.headers) autoMapColumns(sheets[idx].headers);
  }

  function getMappedData() {
    const sheet = sheets[selectedSheet];
    if (!sheet) return [];
    return sheet.rows
      .map((row) => {
        const obj = {};
        for (const field of CHILD_FIELDS) {
          const colIdx = columnMap[field.key];
          if (colIdx !== undefined && colIdx !== "" && colIdx !== -1) {
            obj[field.key] = row[colIdx] || "";
          }
        }
        return obj;
      })
      .filter((r) => r.firstName?.trim());
  }

  async function handleImport() {
    if (!centerId) {
      setError("Please select a center");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);

    const children = getMappedData();
    if (!children.length) {
      setError("No valid rows to import (firstName is required)");
      setLoading(false);
      return;
    }

    try {
      const result = await apiJson("/api/v1/import/children", {
        method: "POST",
        body: JSON.stringify({ centerId, children }),
      });
      setImportResult(result);
      setStep(3);
      setSuccess(`Successfully imported ${result.created} children.`);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  }

  const currentSheet = sheets[selectedSheet];
  const previewRows = currentSheet?.rows?.slice(0, 20) || [];
  const filteredClasses = classes.filter((c) => c.centerId === centerId);

  return (
    <AdminLayout title="Data Import">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Data Import</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Upload Excel files (.xlsx, .xls) to import children records, or upload PDF files for storage.
        </p>

        {error && <Banner kind="error" message={error} />}
        {success && <Banner kind="success" message={success} />}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div style={{ marginTop: 16 }}>
            <Field label="Select File (Excel or PDF)">
              <input
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileUpload}
                style={inputStyle}
                disabled={loading}
              />
            </Field>
            {loading && <p style={{ marginTop: 8, color: "#6b7280" }}>Processing file...</p>}

            {fileType === "pdf" && pdfUrl && (
              <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontWeight: 800 }}>PDF Uploaded Successfully</div>
                <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", marginTop: 4, display: "inline-block" }}>
                  View / Download PDF
                </a>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview & Map */}
        {step === 2 && currentSheet && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <button type="button" onClick={() => { setStep(1); setSheets([]); setFileType(null); }} style={secondaryButton}>
                Back
              </button>
              {sheets.length > 1 && (
                <Field label="Sheet">
                  <select value={selectedSheet} onChange={(e) => handleSheetChange(Number(e.target.value))} style={inputStyle}>
                    {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <h3 style={{ marginTop: 0 }}>Column Mapping</h3>
            <p style={{ color: "#6b7280", fontSize: 13 }}>Map Excel columns to child record fields.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 8 }}>
              {CHILD_FIELDS.map((field) => (
                <Field key={field.key} label={field.label + (field.required ? " *" : "")}>
                  <select
                    value={columnMap[field.key] ?? ""}
                    onChange={(e) => setColumnMap({ ...columnMap, [field.key]: e.target.value === "" ? undefined : Number(e.target.value) })}
                    style={inputStyle}
                  >
                    <option value="">— skip —</option>
                    {currentSheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </Field>
              ))}
            </div>

            <h3 style={{ marginTop: 16 }}>Preview ({currentSheet.rows.length} rows)</h3>
            <div style={{ overflow: "auto", maxHeight: 300 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>{currentSheet.headers.map((h, i) => <th key={i} style={thStyle}>{h || `Col ${i + 1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={tdStyle}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Import to Center *">
                <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle} required>
                  <option value="">Select center...</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button type="button" onClick={handleImport} disabled={loading} style={primaryButton}>
                {loading ? "Importing..." : `Import ${getMappedData().length} Children`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && importResult && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Import Results</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 8 }}>
              <StatCard label="Created" value={importResult.created} color="#166534" bg="#dcfce7" />
              <StatCard label="Errors" value={importResult.errors?.length || 0} color="#991b1b" bg="#fee2e2" />
            </div>

            {importResult.errors?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4>Errors:</h4>
                {importResult.errors.map((e, i) => (
                  <div key={i} style={{ padding: 6, fontSize: 13, color: "#991b1b" }}>
                    Row {e.index + 1}: {e.error}
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={() => { setStep(1); setSheets([]); setFileType(null); setImportResult(null); setSuccess(""); }} style={{ ...secondaryButton, marginTop: 12 }}>
              Import Another File
            </button>
          </div>
        )}
      </Panel>
    </AdminLayout>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: bg, border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color }}>{label}</div>
    </div>
  );
}

function Panel({ children, style }) {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, ...style }}>{children}</div>;
}
function Field({ label, children }) {
  return <label style={{ display: "block" }}><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>{children}</label>;
}
function Banner({ message, kind }) {
  const s = kind === "success" ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" } : { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  return <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...s }}>{message}</div>;
}

const inputStyle = { width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, boxSizing: "border-box" };
const primaryButton = { padding: "10px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800 };
const secondaryButton = { padding: "9px 12px", background: "white", color: "#111827", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontWeight: 800 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle = { padding: "8px 10px", background: "#f9fafb", borderBottom: "2px solid #e5e7eb", textAlign: "left", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" };
const tdStyle = { padding: "6px 10px", borderBottom: "1px solid #f3f4f6", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
