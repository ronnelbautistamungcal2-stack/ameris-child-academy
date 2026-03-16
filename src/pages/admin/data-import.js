import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

const CHILD_FIELDS = [
  { key: "firstName", label: "First Name", required: true, icon: "👤" },
  { key: "lastName", label: "Last Name", icon: "👤" },
  { key: "birthDate", label: "Birth Date", icon: "🎂" },
  { key: "parentEmail", label: "Parent Email", icon: "📧" },
  { key: "emergencyContact", label: "Emergency Contact", icon: "🚨" },
  { key: "allergies", label: "Allergies", icon: "⚠️" },
];

const STEPS = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Map & Preview" },
  { num: 3, label: "Results" },
];

export default function DataImport() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 - file
  const [fileType, setFileType] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fileName, setFileName] = useState("");

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
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";

    try {
      const dataBase64 = await fileToBase64(file);

      if (isPdf) {
        const uploaded = await apiJson("/api/v1/uploads", {
          method: "POST",
          body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
        });
        setPdfUrl(uploaded.url);
        setFileType("pdf");
        setSuccess(`PDF uploaded: ${uploaded.originalName || file.name}`);
      } else {
        const result = await apiJson("/api/v1/import/parse-excel", {
          method: "POST",
          body: JSON.stringify({ dataBase64 }),
        });
        setSheets(result.sheets || []);
        setSelectedSheet(0);
        setFileType("excel");

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

  function resetAll() {
    setStep(1);
    setSheets([]);
    setFileType(null);
    setImportResult(null);
    setSuccess("");
    setError("");
    setFileName("");
    setPdfUrl(null);
    setColumnMap({});
  }

  const currentSheet = sheets[selectedSheet];
  const previewRows = currentSheet?.rows?.slice(0, 20) || [];
  const mappedCount = getMappedData().length;
  const mappedFields = Object.keys(columnMap).filter((k) => columnMap[k] !== undefined).length;

  return (
    <AdminLayout title="Data Import">
      {/* Page Header */}
      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            📥
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--admin-text)" }}>Data Import</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 2, fontSize: 13 }}>
              Upload Excel files to import children records, or upload PDFs for document storage.
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 20 }}>
          {STEPS.map((s, i) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px", borderRadius: 10,
                  background: isActive ? "#1e3a8a" : isDone ? "#D1FAE5" : "var(--admin-bg-secondary, #F3F4F6)",
                  color: isActive ? "white" : isDone ? "#065F46" : "var(--admin-text-muted)",
                  fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "rgba(255,255,255,0.2)" : isDone ? "#A7F3D0" : "var(--admin-border)",
                    fontSize: 12, fontWeight: 800,
                  }}>
                    {isDone ? "✓" : s.num}
                  </span>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, margin: "0 8px",
                    background: step > s.num ? "#10B981" : "var(--admin-border)",
                    transition: "background 0.3s",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <Banner kind="error" message={error} />}
      {success && <Banner kind="success" message={success} />}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div style={{ ...panelStyle, marginTop: 16 }}>
          <SectionHeader icon="📂" title="Upload File" />

          {/* Drag & Drop Zone */}
          <label
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              marginTop: 16, padding: "40px 24px",
              border: "2px dashed var(--admin-border)",
              borderRadius: 16, cursor: "pointer",
              background: loading ? "var(--admin-bg-secondary)" : "var(--admin-bg)",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#EFF6FF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.background = "var(--admin-bg)"; }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={handleFileUpload}
              disabled={loading}
              style={{ display: "none" }}
            />
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
              {loading ? "⏳" : "📄"}
            </div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>
              {loading ? "Processing file..." : "Click to upload a file"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
              Supports .xlsx, .xls, and .pdf files
            </div>
            {fileName && !loading && (
              <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: 12, fontWeight: 600, color: "#166534" }}>
                📎 {fileName}
              </div>
            )}
          </label>

          {/* Supported formats info */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={infoCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--admin-text)" }}>Excel Files</div>
                  <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 2 }}>
                    .xlsx, .xls — Import children records with column mapping
                  </div>
                </div>
              </div>
            </div>
            <div style={infoCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>📑</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--admin-text)" }}>PDF Files</div>
                  <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 2 }}>
                    Upload and store documents for reference
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PDF upload result */}
          {fileType === "pdf" && pdfUrl && (
            <div style={{ marginTop: 16, padding: 16, background: "#F0FDF4", borderRadius: 12, border: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#166534" }}>PDF Uploaded Successfully</div>
                  <div style={{ fontSize: 12, color: "#15803D", marginTop: 2 }}>{fileName}</div>
                </div>
              </div>
              <a href={pdfUrl} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                View PDF →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Map & Preview */}
      {step === 2 && currentSheet && (
        <div style={{ marginTop: 16 }}>
          {/* Column Mapping */}
          <div style={panelStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <SectionHeader icon="🔗" title="Column Mapping" />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {sheets.length > 1 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sheet:</span>
                    <select value={selectedSheet} onChange={(e) => handleSheetChange(Number(e.target.value))} style={selectStyle}>
                      {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" onClick={resetAll} style={secondaryBtnStyle}>
                  ← Back
                </button>
              </div>
            </div>

            <p style={{ color: "var(--admin-text-muted)", fontSize: 12, marginTop: 4, marginBottom: 12 }}>
              Map your spreadsheet columns to child record fields. Auto-mapped columns are highlighted.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {CHILD_FIELDS.map((field) => {
                const isMapped = columnMap[field.key] !== undefined;
                return (
                  <div key={field.key} style={{
                    padding: 12, borderRadius: 12,
                    border: `1px solid ${isMapped ? "#BBF7D0" : "var(--admin-border)"}`,
                    background: isMapped ? "#F0FDF4" : "var(--admin-bg)",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{field.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text)" }}>
                        {field.label}
                        {field.required && <span style={{ color: "#DC2626", marginLeft: 2 }}>*</span>}
                      </span>
                      {isMapped && <span style={{ fontSize: 10, marginLeft: "auto", color: "#16A34A", fontWeight: 800 }}>✓ Mapped</span>}
                    </div>
                    <select
                      value={columnMap[field.key] ?? ""}
                      onChange={(e) => setColumnMap({ ...columnMap, [field.key]: e.target.value === "" ? undefined : Number(e.target.value) })}
                      style={selectStyle}
                    >
                      <option value="">— skip —</option>
                      {currentSheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Mapping summary */}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ padding: "4px 10px", borderRadius: 8, background: mappedFields === CHILD_FIELDS.length ? "#D1FAE5" : "#FEF3C7", fontWeight: 700, color: mappedFields === CHILD_FIELDS.length ? "#065F46" : "#92400E" }}>
                {mappedFields}/{CHILD_FIELDS.length} fields mapped
              </span>
              <span style={{ color: "var(--admin-text-muted)", fontWeight: 600 }}>
                · {mappedCount} valid rows detected
              </span>
            </div>
          </div>

          {/* Data Preview */}
          <div style={{ ...panelStyle, marginTop: 16 }}>
            <SectionHeader icon="👁️" title={`Data Preview (${currentSheet.rows.length} rows)`} />
            <div style={{ overflow: "auto", maxHeight: 320, marginTop: 12, borderRadius: 12, border: "1px solid var(--admin-border)" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {currentSheet.headers.map((h, i) => {
                      const mappedTo = CHILD_FIELDS.find((f) => columnMap[f.key] === i);
                      return (
                        <th key={i} style={{
                          ...thStyle,
                          background: mappedTo ? "#EFF6FF" : "var(--admin-bg-secondary)",
                          color: mappedTo ? "#1E40AF" : "var(--admin-text-muted)",
                        }}>
                          {h || `Col ${i + 1}`}
                          {mappedTo && (
                            <div style={{ fontSize: 9, fontWeight: 600, color: "#3B82F6", marginTop: 2 }}>
                              → {mappedTo.label}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "var(--admin-bg)" : "var(--admin-bg-secondary)" }}>
                      {row.map((cell, ci) => {
                        const isMappedCol = CHILD_FIELDS.some((f) => columnMap[f.key] === ci);
                        return (
                          <td key={ci} style={{
                            ...tdStyle,
                            fontWeight: isMappedCol ? 600 : 400,
                            color: isMappedCol ? "var(--admin-text)" : "var(--admin-text-muted)",
                          }}>{cell}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Target */}
          <div style={{ ...panelStyle, marginTop: 16 }}>
            <SectionHeader icon="🎯" title="Import Destination" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, maxWidth: 500 }}>
              <label style={{ display: "block" }}>
                <div style={fieldLabelStyle}>Center *</div>
                <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={selectStyle} required>
                  <option value="">Select center...</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={handleImport} disabled={loading || !mappedCount} style={{
                ...primaryBtnStyle,
                opacity: loading || !mappedCount ? 0.5 : 1,
                cursor: loading || !mappedCount ? "not-allowed" : "pointer",
              }}>
                {loading ? "⏳ Importing..." : `📥 Import ${mappedCount} Children`}
              </button>
              <button type="button" onClick={resetAll} style={secondaryBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && importResult && (
        <div style={{ ...panelStyle, marginTop: 16 }}>
          <SectionHeader icon="🎉" title="Import Complete" />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
            <ResultCard icon="✅" label="Created" value={importResult.created} bg="#D1FAE5" color="#065F46" border="#A7F3D0" />
            <ResultCard icon="❌" label="Errors" value={importResult.errors?.length || 0} bg={importResult.errors?.length ? "#FEE2E2" : "#F3F4F6"} color={importResult.errors?.length ? "#991B1B" : "#6B7280"} border={importResult.errors?.length ? "#FECACA" : "#E5E7EB"} />
          </div>

          {importResult.errors?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#991B1B", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span>⚠️</span> Import Errors
              </div>
              <div style={{ borderRadius: 12, border: "1px solid #FECACA", overflow: "hidden" }}>
                {importResult.errors.map((e, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", fontSize: 13,
                    background: i % 2 === 0 ? "#FEF2F2" : "#FFF",
                    borderBottom: i < importResult.errors.length - 1 ? "1px solid #FECACA" : "none",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontWeight: 800, color: "#DC2626", fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "#FEE2E2", whiteSpace: "nowrap" }}>Row {e.index + 1}</span>
                    <span style={{ color: "#991B1B" }}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button type="button" onClick={resetAll} style={primaryBtnStyle}>
              📥 Import Another File
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 15, color: "var(--admin-text)" }}>{title}</span>
    </div>
  );
}

function ResultCard({ icon, label, value, bg, color, border }) {
  return (
    <div style={{ padding: 18, borderRadius: 14, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color, opacity: 0.8 }}>{label}</div>
      </div>
    </div>
  );
}

function Banner({ message, kind }) {
  const isSuccess = kind === "success";
  return (
    <div style={{
      padding: 14, borderRadius: 12, marginTop: 16,
      display: "flex", alignItems: "center", gap: 10,
      background: isSuccess ? "#F0FDF4" : "#FEF2F2",
      border: `1px solid ${isSuccess ? "#BBF7D0" : "#FECACA"}`,
      color: isSuccess ? "#166534" : "#991B1B",
      fontWeight: 600, fontSize: 13,
    }}>
      <span style={{ fontSize: 16 }}>{isSuccess ? "✅" : "❌"}</span>
      {message}
    </div>
  );
}

/* ── Styles ── */

const panelStyle = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 20,
};

const infoCardStyle = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg-secondary, #F9FAFB)",
};

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  boxSizing: "border-box",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  fontSize: 13,
};

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "12px 20px",
  background: "linear-gradient(135deg, #1e3a8a, #0284c7)",
  color: "white",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const secondaryBtnStyle = {
  padding: "10px 16px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const linkButtonStyle = {
  padding: "8px 14px",
  borderRadius: 10,
  background: "#166534",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 12,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const thStyle = {
  padding: "10px 12px",
  borderBottom: "2px solid var(--admin-border)",
  textAlign: "left",
  fontWeight: 800,
  fontSize: 11,
  whiteSpace: "nowrap",
  color: "var(--admin-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tdStyle = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--admin-border-light, #F3F4F6)",
  maxWidth: 200,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
