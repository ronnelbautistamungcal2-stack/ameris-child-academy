import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { AGE_GROUPS } from "@/lib/ageUtils";
import { canonicalizeLessonCategoryName } from "@/lib/lessonCategoryNormalization.mjs";
import { normalizeSubjectForRef } from "@/lib/subjectNormalization.mjs";
import { useCallback, useEffect, useMemo, useState } from "react";

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function byString(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function normalizeSpaces(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeSpaces(value).toLowerCase();
}

function normalizeLessonTerm(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return "";
  const numeric = raw.match(/^(?:term\s*)?(\d+)$/i);
  if (numeric) return `Term ${numeric[1]}`;
  return raw;
}

function normalizeLessonCategory(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return "";
  return canonicalizeLessonCategoryName(raw) || raw;
}

function byNaturalString(a, b) {
  return naturalCollator.compare(normalizeSpaces(a), normalizeSpaces(b));
}

function mergeSelectOptions(defaults, extras) {
  const seen = new Set();
  const out = [];

  const add = (value) => {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalizeSpaces(value));
  };

  for (const value of defaults) add(value);
  for (const value of [...extras].sort(byNaturalString)) add(value);

  return out;
}

const REF_DOMAIN_ORDER = new Map([
  ["S", 0], // Spiritual
  ["D", 1], // Development
  ["A", 2], // Academics
  ["L", 3], // Life Skills
]);

const DEFAULT_LESSON_AGE_OPTIONS = AGE_GROUPS.map((group) => group.label);
const DEFAULT_LESSON_CATEGORY_OPTIONS = [
  "Academics",
  "Cognitive",
  "Communication",
  "Creative Arts",
  "Development",
  "Fine Arts",
  "General",
  "Health And Safety",
  "Knowledge",
  "Language And Literacy",
  "Life Skills",
  "Lifelong Learning Practices",
  "Math And Reasoning",
  "Physical Development",
  "Science",
  "Social Skills",
  "Spiritual",
  "Talent Exploration",
  "Task Training",
  "Well-being",
];
const DEFAULT_LESSON_TERM_OPTIONS = ["Term 1", "Term 2", "Term 3", "Term 4", "Term 5"];

function collectCategoryOptions(records, { childAge = "", term = "" } = {}) {
  const ageKey = normalizeSpaces(childAge);
  const termKey = normalizeSpaces(term);
  const categories = new Set();

  for (const record of records) {
    if (ageKey && normalizeSpaces(record.childAge) !== ageKey) continue;
    if (termKey && normalizeSpaces(record.term) !== termKey) continue;
    if (record.category) categories.add(normalizeLessonCategory(record.category));
  }

  return [...categories].sort((a, b) => byString(a, b));
}

function collectSubjectOptions(records, { childAge = "", category = "", term = "" } = {}) {
  const ageKey = normalizeSpaces(childAge);
  const categoryKey = normalizeLessonCategory(category);
  const termKey = normalizeSpaces(term);
  const subjects = new Set();

  for (const record of records) {
    if (ageKey && normalizeSpaces(record.childAge) !== ageKey) continue;
    if (categoryKey && normalizeLessonCategory(record.category) !== categoryKey) continue;
    if (termKey && normalizeSpaces(record.term) !== termKey) continue;
    if (record.subject) subjects.add(normalizeSpaces(record.subject));
  }

  return [...subjects].sort((a, b) => byString(a, b));
}

function collectManagerCategoryOptions(categories, { childAge = "" } = {}) {
  const ageKey = normalizeSpaces(childAge);
  const values = new Set();

  for (const category of Array.isArray(categories) ? categories : []) {
    if (ageKey && normalizeSpaces(category?.ageRange) !== ageKey) continue;
    if (category?.name) values.add(normalizeLessonCategory(category.name));
  }

  return [...values].sort((a, b) => byString(a, b));
}

function collectManagerAgeRangeOptions(categories) {
  const values = new Set();

  for (const category of Array.isArray(categories) ? categories : []) {
    const ageRange = normalizeSpaces(category?.ageRange);
    if (ageRange) values.add(ageRange);
  }

  return [...values].sort(byNaturalString);
}

function parseRefIdParts(value) {
  const raw = normalizeSpaces(value);
  if (!raw) return null;

  const dotParts = raw.split(".").map((p) => p.trim());
  const agePart = dotParts[0] || "";
  const ageMatch = agePart.match(/^(\d+)\s*([a-zA-Z]+)?$/);
  const ageNum = ageMatch ? Number(ageMatch[1]) : Number.NaN;
  const ageUnit = ageMatch?.[2]?.toLowerCase() || "";

  const domainAndCode = dotParts[1] || "";
  const [domainRaw, ...codeRest] = domainAndCode
    .split("-")
    .map((p) => p.trim());
  const domain = domainRaw || "";
  const code = codeRest.join("-") || "";

  const tail = dotParts.slice(2);
  const tailTokens = tail.flatMap((part) => {
    const m = String(part || "").match(/^(\d+)(.*)$/);
    if (!m) return [{ type: "text", value: part }];
    const n = Number(m[1]);
    const rest = m[2] || "";
    const out = [{ type: "num", value: n }];
    if (rest) out.push({ type: "text", value: rest });
    return out;
  });

  const domainRank = REF_DOMAIN_ORDER.has(domain)
    ? REF_DOMAIN_ORDER.get(domain)
    : 99;
  const ageUnitRank = ageUnit === "m" ? 0 : ageUnit === "y" ? 1 : 2;

  return {
    raw,
    ageNum,
    ageUnitRank,
    domainRank,
    domain,
    code,
    tailTokens,
  };
}

function byReferenceId(a, b) {
  const left = normalizeSpaces(a);
  const right = normalizeSpaces(b);
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const pa = parseRefIdParts(left);
  const pb = parseRefIdParts(right);
  if (!pa || !pb) return naturalCollator.compare(left, right);

  const aAgeValid = Number.isFinite(pa.ageNum);
  const bAgeValid = Number.isFinite(pb.ageNum);
  if (aAgeValid && bAgeValid) {
    if (pa.ageNum !== pb.ageNum) return pa.ageNum - pb.ageNum;
    if (pa.ageUnitRank !== pb.ageUnitRank)
      return pa.ageUnitRank - pb.ageUnitRank;
  } else if (aAgeValid !== bAgeValid) {
    return aAgeValid ? -1 : 1;
  }

  if (pa.domainRank !== pb.domainRank) return pa.domainRank - pb.domainRank;

  const domainCmp = naturalCollator.compare(pa.domain, pb.domain);
  if (domainCmp !== 0) return domainCmp;

  const codeCmp = naturalCollator.compare(pa.code, pb.code);
  if (codeCmp !== 0) return codeCmp;

  const n = Math.max(pa.tailTokens.length, pb.tailTokens.length);
  for (let i = 0; i < n; i++) {
    const ta = pa.tailTokens[i];
    const tb = pb.tailTokens[i];
    if (!ta && !tb) break;
    if (!ta) return -1;
    if (!tb) return 1;

    if (ta.type === "num" && tb.type === "num") {
      if (ta.value !== tb.value) return ta.value - tb.value;
      continue;
    }

    if (ta.type !== tb.type) {
      return ta.type === "num" ? -1 : 1;
    }

    const tCmp = naturalCollator.compare(String(ta.value), String(tb.value));
    if (tCmp !== 0) return tCmp;
  }

  return naturalCollator.compare(pa.raw, pb.raw);
}

function isProbablyLink(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return (
    s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")
  );
}

function isImageUrl(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(s);
}

function splitResources(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|\n|;)\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function emptySupplyRow() {
  return { name: "", quantity: 1, quantityType: "total", unit: "" };
}

function supplyRowsFromLesson(lesson) {
  return (lesson?.supplies || []).map((s) => ({
    name: s.name || "",
    quantity: s.quantity || 1,
    quantityType: s.quantityType === "per_student" ? "per_student" : "total",
    unit: s.unit || "",
  }));
}

function addSupplyRow(setRows) {
  setRows((prev) => [...prev, emptySupplyRow()]);
}

function removeSupplyRow(setRows, index) {
  setRows((prev) => prev.filter((_, i) => i !== index));
}

function updateSupplyRow(setRows, index, field, value) {
  setRows((prev) =>
    prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  );
}

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

async function uploadFiles(files) {
  const arr = Array.isArray(files) ? files : [];
  const out = [];
  for (const f of arr) {
    const dataBase64 = await fileToBase64(f);
    const uploaded = await apiJson("/api/v1/uploads", {
      method: "POST",
      body: JSON.stringify({
        filename: f.name,
        mimeType: f.type,
        dataBase64,
      }),
    });
    out.push({ ...uploaded, uploadedAt: new Date().toISOString() });
  }
  return out;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function downloadCsv({ filename, headers, rows }) {
  const lines = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function categoryBadgeClass(category) {
  const key = normalizeKey(category);
  if (key.includes("cognitive"))
    return "bg-amber-50 text-amber-800 ring-amber-200";
  if (key.includes("spiritual"))
    return "bg-blue-50 text-blue-900 ring-blue-200";
  if (key.includes("development"))
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (key.includes("life skills")) return "bg-sky-50 text-sky-800 ring-sky-200";
  return "bg-gray-50 text-gray-800 ring-gray-200";
}

function displayCategory(category) {
  const raw = normalizeSpaces(category);
  const key = normalizeKey(raw);
  if (key === "lifelong learning practices") return "Lifelong Learning";
  return raw;
}

function ageBadgeClass(age) {
  const key = normalizeKey(age);
  if (key.includes("0-6") || key.includes("0 - 6") || key.includes("0–6"))
    return "bg-blue-50 text-blue-800 ring-blue-200";
  if (key.includes("6-12") || key.includes("6 - 12") || key.includes("6–12"))
    return "bg-indigo-50 text-indigo-800 ring-indigo-200";
  if (key.includes("12-24") || key.includes("12 - 24") || key.includes("12–24"))
    return "bg-cyan-50 text-cyan-800 ring-cyan-200";
  if (key.includes("2-3") || key.includes("2 - 3") || key.includes("2–3"))
    return "bg-purple-50 text-purple-800 ring-purple-200";
  return "bg-slate-50 text-slate-800 ring-slate-200";
}

function buildPageItems(current, total) {
  const pages = [];
  const push = (n) => pages.push({ type: "page", value: n });
  const dots = () => pages.push({ type: "dots" });

  if (total <= 7) {
    for (let i = 1; i <= total; i++) push(i);
    return pages;
  }

  push(1);
  if (current <= 4) {
    for (let i = 2; i <= 5; i++) push(i);
    dots();
    push(total);
    return pages;
  }

  if (current >= total - 3) {
    dots();
    for (let i = total - 4; i <= total; i++) push(i);
    return pages;
  }

  dots();
  push(current - 1);
  push(current);
  push(current + 1);
  dots();
  push(total);
  return pages;
}

function IconSearch(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLayers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEdit(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFilter(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheckCircle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 4 12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlertCircle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClipboard(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconCopy(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
      <div
        className={[
          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg",
          type === "success"
            ? "bg-emerald-600 text-white"
            : type === "error"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-white",
        ].join(" ")}
      >
        {type === "success" ? (
          <IconCheckCircle className="h-5 w-5 flex-shrink-0" />
        ) : type === "error" ? (
          <IconAlertCircle className="h-5 w-5 flex-shrink-0" />
        ) : null}
        <span>{message}</span>
        <button type="button" onClick={onClose} className="ml-2 rounded-lg p-1 hover:bg-white/20">
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ConfirmDeleteDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <IconTrash className="h-6 w-6 text-red-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-4 w-20 rounded bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-4 w-40 rounded bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-4 w-28 rounded bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-5 w-16 rounded-full bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-4 w-14 rounded bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-5 w-20 rounded-full bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-4 w-32 rounded bg-gray-200" /></td>
      <td className="border-t border-gray-100 px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
    </tr>
  );
}

function IconDownload(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4M5 15v4h14v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRefresh(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M20 6v6h-6M4 18v-6h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12a8 8 0 0 0-14.9-4M4 12a8 8 0 0 0 14.9 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({ label, value, sublabel, icon: Icon, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };
  const accent = colorMap[color] || colorMap.blue;

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900">{value}</div>
          {sublabel ? (
            <div className="mt-1 text-xs text-gray-500">{sublabel}</div>
          ) : null}
        </div>
        {Icon ? (
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl animate-modal-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
          <h2 className="truncate text-lg font-bold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {children}
    </label>
  );
}

function SupplyRowsEditor({ rows, setRows, disabled }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Supplies List (optional)
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[10rem] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                placeholder="Supply name"
                value={row.name}
                onChange={(e) => updateSupplyRow(setRows, idx, "name", e.target.value)}
                disabled={disabled}
              />
              <input
                type="number"
                min="1"
                className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-center"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => updateSupplyRow(setRows, idx, "quantity", parseInt(e.target.value, 10) || 1)}
                disabled={disabled}
              />
              <select
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
                value={row.quantityType || "total"}
                onChange={(e) => updateSupplyRow(setRows, idx, "quantityType", e.target.value)}
                disabled={disabled}
              >
                <option value="total">Total</option>
                <option value="per_student">Per Student</option>
              </select>
              <input
                className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
                placeholder="Unit"
                value={row.unit}
                onChange={(e) => updateSupplyRow(setRows, idx, "unit", e.target.value)}
                disabled={disabled}
              />
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                onClick={() => removeSupplyRow(setRows, idx)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No supplies added yet.</div>
      )}
      <button
        type="button"
        className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        onClick={() => addSupplyRow(setRows)}
        disabled={disabled}
      >
        + Add Supply
      </button>
      <p className="mt-1 text-xs text-gray-500">
        Supplies added here automatically appear on the center&apos;s{" "}
        <a href="/admin/supply-lists" className="font-semibold text-sky-700 hover:text-sky-800">
          Supply List
        </a>
        .
      </p>
    </div>
  );
}

export default function AdminLessons() {
  const [centers, setCenters] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [lessonCategories, setLessonCategories] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState(null);

  const [search, setSearch] = useState("");
  const [age, setAge] = useState("");
  const [category, setCategory] = useState("");
  const [term, setTerm] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRecord, setDetailsRecord] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editChildAge, setEditChildAge] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editStep, setEditStep] = useState("");
  const [editTestingQuestion, setEditTestingQuestion] = useState("");
  const [editResource, setEditResource] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editEssentialQuestions, setEditEssentialQuestions] = useState("");
  const [editKeyVocabulary, setEditKeyVocabulary] = useState("");
  const [editNotesToTeacher, setEditNotesToTeacher] = useState("");
  const [editIntroduction, setEditIntroduction] = useState("");
  const [editInstructionalSetting, setEditInstructionalSetting] = useState("");
  const [editLearningActivities, setEditLearningActivities] = useState("");
  const [editAccommodations, setEditAccommodations] = useState("");
  const [editTimeRequired, setEditTimeRequired] = useState("");
  const [editSupplyRows, setEditSupplyRows] = useState([]);

  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newChildAge, setNewChildAge] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newReference, setNewReference] = useState("");
  const [newStep, setNewStep] = useState("");
  const [newTestingQuestion, setNewTestingQuestion] = useState("");
  const [newResource, setNewResource] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newEssentialQuestions, setNewEssentialQuestions] = useState("");
  const [newKeyVocabulary, setNewKeyVocabulary] = useState("");
  const [newNotesToTeacher, setNewNotesToTeacher] = useState("");
  const [newIntroduction, setNewIntroduction] = useState("");
  const [newInstructionalSetting, setNewInstructionalSetting] = useState("");
  const [newLearningActivities, setNewLearningActivities] = useState("");
  const [newAccommodations, setNewAccommodations] = useState("");
  const [newTimeRequired, setNewTimeRequired] = useState("");
  const [newSupplyRows, setNewSupplyRows] = useState([]);

  const loading = loadingCenters || loadingLessons;

  const mainCenter = useMemo(() => {
    const arr = Array.isArray(centers) ? centers : [];
    const sorted = arr.slice().sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime();
      const tb = new Date(b?.createdAt || 0).getTime();
      if (ta && tb && ta !== tb) return ta - tb;
      return byString(a?.name, b?.name);
    });
    return sorted[0] || null;
  }, [centers]);

  const refreshCenters = useCallback(async () => {
    setLoadingCenters(true);
    setError("");
    try {
      const data = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(data) ? data : []);
    } catch (e) {
      setCenters([]);
      setError(e.message || "Failed to load centers");
    } finally {
      setLoadingCenters(false);
    }
  }, []);

  const refreshLessons = useCallback(async () => {
    if (!mainCenter?.id) {
      setLessons([]);
      return;
    }

    setLoadingLessons(true);
    setError("");
    try {
      const data = await apiJson(
        `/api/v1/lessons?centerId=${encodeURIComponent(mainCenter.id)}`,
      );
      setLessons(Array.isArray(data) ? data : []);
    } catch (e) {
      setLessons([]);
      setError(e.message || "Failed to load curriculum lessons");
    } finally {
      setLoadingLessons(false);
    }
  }, [mainCenter?.id]);

  const refreshLessonCategories = useCallback(async () => {
    if (!mainCenter?.id) {
      setLessonCategories([]);
      return;
    }

    try {
      const data = await apiJson(
        `/api/v1/lesson-categories?centerId=${encodeURIComponent(mainCenter.id)}`,
      );
      setLessonCategories(Array.isArray(data) ? data : []);
    } catch {
      setLessonCategories([]);
    }
  }, [mainCenter?.id]);

  useEffect(() => {
    refreshCenters();
  }, [refreshCenters]);

  useEffect(() => {
    refreshLessons();
  }, [refreshLessons]);

  useEffect(() => {
    refreshLessonCategories();
  }, [refreshLessonCategories]);

  const records = useMemo(() => {
    const out = [];
    for (const lesson of Array.isArray(lessons) ? lessons : []) {
      for (const goal of Array.isArray(lesson?.goals) ? lesson.goals : []) {
        const pc = goal?.passingCriteria || {};
        out.push({
          id: goal?.id,
          lessonId: lesson?.id,
          refId: String(pc.reference ?? ""),
          lessonTitle: String(pc.lesson ?? lesson?.title ?? ""),
          subject: normalizeSubjectForRef({
            subject: String(pc.subject ?? ""),
            refId: String(pc.reference ?? ""),
          }),
          childAge: String(pc.age ?? ""),
          term: normalizeLessonTerm(pc.term ?? ""),
          category: normalizeLessonCategory(
            pc.category ?? lesson?.category?.name ?? "",
          ),
          progressionStep: String(pc.stepOfProgression ?? goal?.title ?? ""),
          testingQuestion: String(
            pc.testingQuestion ?? goal?.description ?? "",
          ),
          resource: String(pc.resource ?? ""),
          additionalResources: String(pc.additionalResources ?? ""),
          lessonAttachment: String(pc.lessonAttachment ?? pc.resource ?? ""),
          notes: String(pc.notes ?? ""),
          sheet: String(pc.sheet ?? ""),
          link: String(pc.link ?? ""),
          essentialQuestions: String(pc.essentialQuestions ?? ""),
          keyVocabulary: String(pc.keyVocabulary ?? ""),
          notesToTeacher: String(pc.notesToTeacher ?? ""),
          introduction: String(pc.introduction ?? ""),
          instructionalSetting: String(pc.instructionalSetting ?? ""),
          learningActivities: String(pc.learningActivities ?? ""),
          accommodations: String(pc.accommodations ?? ""),
          timeRequired: String(pc.timeRequired ?? ""),
          supplies: Array.isArray(lesson?.supplies) ? lesson.supplies : [],
        });
      }
    }
    return out;
  }, [lessons]);

  const options = useMemo(() => {
    const ages = new Set();
    const terms = new Set();
    const cats = new Set();
    const subjects = new Set();

    for (const r of records) {
      if (r.childAge) ages.add(r.childAge);
      if (r.term) terms.add(r.term);
      if (r.category) cats.add(r.category);
      if (r.subject) subjects.add(r.subject);
    }

    return {
      ages: [...ages].sort((a, b) => byString(a, b)),
      terms: [...terms].sort((a, b) => byString(a, b)),
      categories: [...cats].sort((a, b) => byString(a, b)),
      subjects: [...subjects].sort((a, b) => byString(a, b)),
    };
  }, [records]);

  const lessonAgeOptions = useMemo(() => {
    const managedAgeOptions = collectManagerAgeRangeOptions(lessonCategories);
    const baseAgeOptions = managedAgeOptions.length
      ? managedAgeOptions
      : DEFAULT_LESSON_AGE_OPTIONS;
    return mergeSelectOptions(baseAgeOptions, options.ages);
  }, [lessonCategories, options.ages]);

  const lessonTermOptions = useMemo(() => {
    return mergeSelectOptions(DEFAULT_LESSON_TERM_OPTIONS, options.terms);
  }, [options.terms]);

  const subjectOptions = useMemo(() => {
    return collectSubjectOptions(records, { childAge: age, category, term });
  }, [records, age, category, term]);

  const lessonCategoryOptions = useMemo(() => {
    const managerCategories = collectManagerCategoryOptions(lessonCategories);
    return mergeSelectOptions(
      DEFAULT_LESSON_CATEGORY_OPTIONS,
      [...options.categories, ...managerCategories],
    );
  }, [lessonCategories, options.categories]);

  const allLessonSubjectOptions = useMemo(() => {
    return mergeSelectOptions([], options.subjects);
  }, [options.subjects]);

  const editCategoryOptions = useMemo(() => {
    const scoped = collectManagerCategoryOptions(lessonCategories, {
      childAge: editChildAge,
    });
    const current = normalizeLessonCategory(editCategory);
    return mergeSelectOptions(
      scoped.length ? scoped : lessonCategoryOptions,
      current ? [current] : [],
    );
  }, [lessonCategories, editChildAge, lessonCategoryOptions, editCategory]);

  const newCategoryOptions = useMemo(() => {
    const scoped = collectManagerCategoryOptions(lessonCategories, {
      childAge: newChildAge,
    });
    const current = normalizeLessonCategory(newCategory);
    return mergeSelectOptions(
      scoped.length ? scoped : lessonCategoryOptions,
      current ? [current] : [],
    );
  }, [lessonCategories, newChildAge, lessonCategoryOptions, newCategory]);

  const editSubjectOptions = useMemo(() => {
    const scoped = collectSubjectOptions(records, {
      childAge: editChildAge,
      category: editCategory,
      term: editTerm,
    });
    const current = normalizeSpaces(editSubject);
    return mergeSelectOptions(
      scoped.length ? scoped : allLessonSubjectOptions,
      current ? [current] : [],
    );
  }, [
    records,
    editChildAge,
    editCategory,
    editTerm,
    allLessonSubjectOptions,
    editSubject,
  ]);

  const newSubjectOptions = useMemo(() => {
    const scoped = collectSubjectOptions(records, {
      childAge: newChildAge,
      category: newCategory,
      term: newTerm,
    });
    const current = normalizeSpaces(newSubject);
    return mergeSelectOptions(
      scoped.length ? scoped : allLessonSubjectOptions,
      current ? [current] : [],
    );
  }, [
    records,
    newChildAge,
    newCategory,
    newTerm,
    allLessonSubjectOptions,
    newSubject,
  ]);

  const filtered = useMemo(() => {
    const q = normalizeKey(search);
    const ageKey = normalizeSpaces(age);
    const catKey = normalizeSpaces(category);
    const termKey = normalizeSpaces(term);
    const subjectKey = normalizeSpaces(subject);

    const base = records.filter((r) => {
      if (ageKey && normalizeSpaces(r.childAge) !== ageKey) return false;
      if (catKey && normalizeSpaces(r.category) !== catKey) return false;
      if (termKey && normalizeSpaces(r.term) !== termKey) return false;
      if (subjectKey && normalizeSpaces(r.subject) !== subjectKey) return false;
      if (!q) return true;
      const hay = normalizeKey(
        [
          r.refId,
          r.lessonTitle,
          r.subject,
          r.childAge,
          r.term,
          r.category,
          r.progressionStep,
          r.testingQuestion,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return hay.includes(q);
    });

    return base.sort((a, b) => {
      const ref = byReferenceId(a.refId, b.refId);
      if (ref !== 0) return ref;
      return byNaturalString(a.progressionStep, b.progressionStep);
    });
  }, [records, search, age, category, term, subject]);

  useEffect(() => {
    setPage(1);
  }, [search, age, category, term, subject, pageSize]);

  useEffect(() => {
    if (!subject) return;
    const key = normalizeSpaces(subject);
    const hasMatch = subjectOptions.some((s) => normalizeSpaces(s) === key);
    if (!hasMatch) setSubject("");
  }, [subject, subjectOptions]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  }, [filtered.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const termSet = new Set();
    const catCounts = new Map();

    for (const r of records) {
      if (r.term) termSet.add(normalizeKey(r.term));
      if (r.category) {
        const label = normalizeSpaces(r.category);
        catCounts.set(label, (catCounts.get(label) || 0) + 1);
      }
    }

    const sortedCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
    const findBy = (needle) =>
      sortedCats.find(([k]) => normalizeKey(k).includes(needle)) || null;

    const spiritual = findBy("spiritual");
    const cognitive = findBy("cognitive");
    const fallbacks = sortedCats
      .filter(
        ([k]) =>
          !normalizeKey(k).includes("spiritual") &&
          !normalizeKey(k).includes("cognitive"),
      )
      .slice(0, 2);

    return {
      totalLessons: Array.isArray(lessons) ? lessons.length : 0,
      totalRecords: records.length,
      activeTerms: termSet.size,
      secondary: spiritual
        ? { label: spiritual[0], count: spiritual[1] }
        : fallbacks[0]
          ? { label: fallbacks[0][0], count: fallbacks[0][1] }
          : { label: "Modules", count: 0 },
      tertiary: cognitive
        ? { label: cognitive[0], count: cognitive[1] }
        : fallbacks[1]
          ? { label: fallbacks[1][0], count: fallbacks[1][1] }
          : { label: "Modules", count: 0 },
    };
  }, [lessons, records]);

  const openDetails = useCallback((rec) => {
    setDetailsRecord(rec || null);
    setDetailsOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    setDetailsRecord(null);
  }, []);

  const openEdit = useCallback((rec) => {
    setError("");
    setEditRecord(rec || null);
    setEditLessonTitle(String(rec?.lessonTitle || ""));
    setEditChildAge(String(rec?.childAge || ""));
    setEditTerm(normalizeLessonTerm(rec?.term || ""));
    setEditCategory(normalizeLessonCategory(rec?.category || ""));
    setEditSubject(String(rec?.subject || ""));
    setEditReference(String(rec?.refId || ""));
    setEditStep(String(rec?.progressionStep || ""));
    setEditTestingQuestion(String(rec?.testingQuestion || ""));
    setEditResource(String(rec?.lessonAttachment || ""));
    setEditNotes(String(rec?.notes || ""));
    setEditLink(String(rec?.link || ""));
    setEditEssentialQuestions(String(rec?.essentialQuestions || ""));
    setEditKeyVocabulary(String(rec?.keyVocabulary || ""));
    setEditNotesToTeacher(String(rec?.notesToTeacher || ""));
    setEditIntroduction(String(rec?.introduction || ""));
    setEditInstructionalSetting(String(rec?.instructionalSetting || ""));
    setEditLearningActivities(String(rec?.learningActivities || ""));
    setEditAccommodations(String(rec?.accommodations || ""));
    setEditTimeRequired(String(rec?.timeRequired || ""));
    setEditSupplyRows(supplyRowsFromLesson(rec));
    setEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setEditRecord(null);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch("");
    setAge("");
    setCategory("");
    setTerm("");
    setSubject("");
  }, []);

  const runImport = useCallback(async () => {
    setImporting(true);
    setError("");
    setImportResult(null);
    try {
      const result = await apiJson("/api/v1/import/steps-library", {
        method: "POST",
        body: JSON.stringify({ includeCondensedSheet: false }),
      });
      setImportResult(result || null);
      await refreshLessons();
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [refreshLessons]);

  const openCreate = useCallback(() => {
    setError("");
    setNewLessonTitle("");
    setNewChildAge("");
    setNewTerm("");
    setNewCategory("");
    setNewSubject("");
    setNewReference("");
    setNewStep("");
    setNewTestingQuestion("");
    setNewResource("");
    setNewNotes("");
    setNewLink("");
    setNewEssentialQuestions("");
    setNewKeyVocabulary("");
    setNewNotesToTeacher("");
    setNewIntroduction("");
    setNewInstructionalSetting("");
    setNewLearningActivities("");
    setNewAccommodations("");
    setNewTimeRequired("");
    setNewSupplyRows([]);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const openDuplicate = useCallback((rec) => {
    if (!rec) return;
    setError("");
    setNewLessonTitle(String(rec.lessonTitle || ""));
    setNewChildAge(String(rec.childAge || ""));
    setNewTerm(normalizeLessonTerm(rec.term || ""));
    setNewCategory(normalizeLessonCategory(rec.category || ""));
    setNewSubject(String(rec.subject || ""));
    setNewReference("");
    const step = normalizeSpaces(rec.progressionStep || "");
    setNewStep(step ? `${step} (Copy)` : "");
    setNewTestingQuestion(String(rec.testingQuestion || ""));
    setNewResource(String(rec.lessonAttachment || ""));
    setNewNotes(String(rec.notes || ""));
    setNewLink(String(rec.link || ""));
    setNewEssentialQuestions(String(rec.essentialQuestions || ""));
    setNewKeyVocabulary(String(rec.keyVocabulary || ""));
    setNewNotesToTeacher(String(rec.notesToTeacher || ""));
    setNewIntroduction(String(rec.introduction || ""));
    setNewInstructionalSetting(String(rec.instructionalSetting || ""));
    setNewLearningActivities(String(rec.learningActivities || ""));
    setNewAccommodations(String(rec.accommodations || ""));
    setNewTimeRequired(String(rec.timeRequired || ""));
    setNewSupplyRows(supplyRowsFromLesson(rec));
    setCreateOpen(true);
  }, []);

  const saveNewRecord = useCallback(
    async (e) => {
      e.preventDefault();
      if (!mainCenter?.id) return;
      const step = normalizeSpaces(newStep);
      if (!step) {
        setError("Progression step is required.");
        return;
      }

      setSaving(true);
      setError("");
      try {
        await apiJson("/api/v1/curriculum/records", {
          method: "POST",
          body: JSON.stringify({
            centerId: mainCenter.id,
            lessonTitle: normalizeSpaces(newLessonTitle),
            childAge: normalizeSpaces(newChildAge),
            term: normalizeLessonTerm(newTerm),
            category: normalizeLessonCategory(newCategory),
            subject: normalizeSubjectForRef({
              subject: normalizeSpaces(newSubject),
              refId: normalizeSpaces(newReference),
            }),
            reference: normalizeSpaces(newReference),
            progressionStep: step,
            lessonAttachment: String(newResource || ""),
            notes: String(newNotes || ""),
            link: normalizeSpaces(newLink),
            essentialQuestions: String(newEssentialQuestions || ""),
            keyVocabulary: String(newKeyVocabulary || ""),
            notesToTeacher: String(newNotesToTeacher || ""),
            introduction: String(newIntroduction || ""),
            instructionalSetting: normalizeSpaces(newInstructionalSetting),
            learningActivities: String(newLearningActivities || ""),
            accommodations: String(newAccommodations || ""),
            timeRequired: normalizeSpaces(newTimeRequired),
            supplies: newSupplyRows.filter((s) => normalizeSpaces(s.name)),
          }),
        });
        setCreateOpen(false);
        setToast({ message: "Lesson created successfully", type: "success" });
        await refreshLessons();
      } catch (e2) {
        setError(e2.message || "Failed to create record");
        setToast({ message: e2.message || "Failed to create", type: "error" });
      } finally {
        setSaving(false);
      }
    },
    [
      mainCenter?.id,
      newAccommodations,
      newCategory,
      newChildAge,
      newEssentialQuestions,
      newIntroduction,
      newInstructionalSetting,
      newKeyVocabulary,
      newLearningActivities,
      newLessonTitle,
      newLink,
      newNotes,
      newNotesToTeacher,
      newReference,
      newResource,
      newStep,
      newSubject,
      newSupplyRows,
      newTerm,
      newTimeRequired,
      refreshLessons,
    ],
  );

  const saveEditRecord = useCallback(
    async (e) => {
      e.preventDefault();
      if (!editRecord?.id) return;
      const step = normalizeSpaces(editStep);
      if (!step) {
        setError("Progression step is required.");
        return;
      }

      setSaving(true);
      setError("");
      try {
        await apiJson(
          `/api/v1/curriculum/records/${encodeURIComponent(editRecord.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              lessonTitle: normalizeSpaces(editLessonTitle),
              childAge: normalizeSpaces(editChildAge),
              term: normalizeLessonTerm(editTerm),
              category: normalizeLessonCategory(editCategory),
              subject: normalizeSubjectForRef({
                subject: normalizeSpaces(editSubject),
                refId: normalizeSpaces(editReference),
              }),
              reference: normalizeSpaces(editReference),
              progressionStep: step,
              lessonAttachment: String(editResource || ""),
              notes: String(editNotes || ""),
              link: normalizeSpaces(editLink),
              essentialQuestions: String(editEssentialQuestions || ""),
              keyVocabulary: String(editKeyVocabulary || ""),
              notesToTeacher: String(editNotesToTeacher || ""),
              introduction: String(editIntroduction || ""),
              instructionalSetting: normalizeSpaces(editInstructionalSetting),
              learningActivities: String(editLearningActivities || ""),
              accommodations: String(editAccommodations || ""),
              timeRequired: normalizeSpaces(editTimeRequired),
              supplies: editSupplyRows.filter((s) => normalizeSpaces(s.name)),
            }),
          },
        );
        setEditOpen(false);
        setEditRecord(null);
        setToast({ message: "Changes saved successfully", type: "success" });
        await refreshLessons();
      } catch (err) {
        setError(err.message || "Failed to save changes");
        setToast({ message: err.message || "Failed to save", type: "error" });
      } finally {
        setSaving(false);
      }
    },
    [
      editAccommodations,
      editCategory,
      editChildAge,
      editEssentialQuestions,
      editIntroduction,
      editInstructionalSetting,
      editKeyVocabulary,
      editLearningActivities,
      editLessonTitle,
      editLink,
      editNotes,
      editNotesToTeacher,
      editRecord?.id,
      editReference,
      editResource,
      editStep,
      editSubject,
      editSupplyRows,
      editTerm,
      editTimeRequired,
      refreshLessons,
    ],
  );

  const uploadAndAppendToField = useCallback(
    async (files, currentValue, setValue, setUploading) => {
      const arr = Array.from(files || []);
      if (!arr.length) return;
      setUploading(true);
      setError("");
      try {
        const uploaded = await uploadFiles(arr);
        const urls = uploaded.map((u) => u?.url).filter(Boolean);
        const existing = splitResources(currentValue);
        const next = [...existing, ...urls].join("\n");
        setValue(next);
      } catch (err) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const confirmDelete = useCallback(
    async () => {
      if (!deleteTarget?.id) return;
      setDeleting(true);
      setError("");
      try {
        await apiJson(
          `/api/v1/curriculum/records/${encodeURIComponent(deleteTarget.id)}`,
          { method: "DELETE" },
        );
        setDeleteTarget(null);
        setToast({ message: "Record deleted successfully", type: "success" });
        await refreshLessons();
      } catch (err) {
        setError(err.message || "Failed to delete record");
        setToast({ message: err.message || "Failed to delete", type: "error" });
      } finally {
        setDeleting(false);
      }
    },
    [deleteTarget?.id, refreshLessons],
  );

  const activeFilterCount = [age, category, term, subject].filter(Boolean).length;

  return (
    <AdminLayout title="Curriculum Lessons">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <IconBook className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">
                  Curriculum Lessons
                </h1>
                <p className="text-sm text-gray-500">
                  Manage early childhood development modules and tracking
                  {mainCenter?.name ? (
                    <> &middot; <span className="font-medium text-gray-700">{mainCenter.name}</span></>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow transition-all disabled:opacity-60"
              onClick={() =>
                downloadCsv({
                  filename: "curriculum-lessons.csv",
                  headers: [
                    "Ref ID",
                    "Lesson Title",
                    "Subject",
                    "Child Age",
                    "Term",
                    "Category",
                    "Progression Step",
                    "Link",
                    "Time Required",
                    "Instructional Setting",
                    "Introduction",
                    "Essential Questions",
                    "Key Vocabulary",
                    "Learning Activities",
                    "Accommodations/Modifications",
                    "Notes to Teacher",
                    "Additional Resources",
                    "Notes",
                    "Sheet",
                  ],
                  rows: filtered.map((r) => [
                    r.refId,
                    r.lessonTitle,
                    r.subject,
                    r.childAge,
                    r.term,
                    r.category,
                    r.progressionStep,
                    r.link,
                    r.timeRequired,
                    r.instructionalSetting,
                    r.introduction,
                    r.essentialQuestions,
                    r.keyVocabulary,
                    r.learningActivities,
                    r.accommodations,
                    r.notesToTeacher,
                    r.lessonAttachment,
                    r.notes,
                    r.sheet,
                  ]),
                })
              }
              disabled={loading || filtered.length === 0}
            >
              <IconDownload className="h-4 w-4" />
              Export
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow transition-all disabled:opacity-60"
              onClick={runImport}
              disabled={importing || loading || !mainCenter?.id}
              title="Import/refresh curriculum from public/uploads/StepsofProgressionLibrary.xlsx"
            >
              <IconRefresh className={`h-4 w-4 ${importing ? "animate-spin" : ""}`} />
              {importing ? "Syncing..." : "Sync Library"}
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all disabled:opacity-60"
              onClick={openCreate}
              disabled={loading || !mainCenter?.id}
            >
              <IconPlus className="h-4 w-4" />
              New Lesson
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <IconAlertCircle className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-red-800">Something went wrong</div>
              <div className="mt-0.5 text-sm text-red-700">{error}</div>
            </div>
            <button type="button" className="ml-auto flex-shrink-0 rounded-lg p-1 text-red-400 hover:bg-red-100 hover:text-red-600" onClick={() => setError("")}>
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {importResult?.totals ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <IconCheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-emerald-800">Sync completed successfully</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-700">
                <span><span className="font-semibold">{importResult.totals.rowsImported}</span> rows imported</span>
                <span><span className="font-semibold">{importResult.totals.categoriesCreated}</span> categories created</span>
                <span><span className="font-semibold">{importResult.totals.lessonsCreated}</span> lessons created</span>
                <span><span className="font-semibold">{importResult.totals.lessonsUpdated}</span> lessons updated</span>
                <span><span className="font-semibold">{importResult.totals.goalsCreated}</span> goals created</span>
              </div>
            </div>
            <button type="button" className="ml-auto flex-shrink-0 rounded-lg p-1 text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600" onClick={() => setImportResult(null)}>
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Lessons"
            value={stats.totalLessons.toLocaleString()}
            sublabel={`${stats.totalRecords.toLocaleString()} progression steps`}
            icon={IconBook}
            color="blue"
          />
          <StatCard
            label="Active Terms"
            value={stats.activeTerms.toLocaleString()}
            sublabel="Distinct terms found"
            icon={IconCalendar}
            color="emerald"
          />
          <StatCard
            label={`${stats.secondary.label}`}
            value={Number(stats.secondary.count || 0).toLocaleString()}
            sublabel="Modules"
            icon={IconLayers}
            color="amber"
          />
          <StatCard
            label={`${stats.tertiary.label}`}
            value={Number(stats.tertiary.count || 0).toLocaleString()}
            sublabel="Modules"
            icon={IconClipboard}
            color="purple"
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <IconFilter className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filters</span>
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            <label className="block md:col-span-2">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Search
              </div>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, ref ID, subject..."
                  disabled={loading}
                />
                {search ? (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                    onClick={() => setSearch("")}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Child Age
              </div>
              <select
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors ${age ? "border-blue-300 bg-blue-50/50 font-medium text-blue-900" : "border-gray-200"}`}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={loading}
              >
                <option value="">All Ages</option>
                {options.ages.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Category
              </div>
              <select
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors ${category ? "border-blue-300 bg-blue-50/50 font-medium text-blue-900" : "border-gray-200"}`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              >
                <option value="">All Categories</option>
                {options.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Term
              </div>
              <select
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors ${term ? "border-blue-300 bg-blue-50/50 font-medium text-blue-900" : "border-gray-200"}`}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading}
              >
                <option value="">All Terms</option>
                {options.terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Subject
              </div>
              <select
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors ${subject ? "border-blue-300 bg-blue-50/50 font-medium text-blue-900" : "border-gray-200"}`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
              >
                <option value="">All Subjects</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end md:col-span-1">
              <button
                type="button"
                className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${activeFilterCount > 0 ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"}`}
                onClick={resetFilters}
                disabled={loading}
              >
                {activeFilterCount > 0 ? `Clear (${activeFilterCount})` : "Reset"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-3">
            <div className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-800">
                {filtered.length ? (page - 1) * pageSize + 1 : 0}
              </span>
              {" "}&ndash;{" "}
              <span className="font-semibold text-gray-800">
                {Math.min(page * pageSize, filtered.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-800">
                {filtered.length.toLocaleString()}
              </span>{" "}
              results
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium">Show</span>
              <select
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium focus:border-blue-300 focus:ring-1 focus:ring-blue-100 focus:outline-none"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value || 10))}
                disabled={loading}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="font-medium">per page</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Ref ID
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Lesson Title
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Subject
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Child Age
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Term
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Progression Step
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                          <IconBook className="h-8 w-8 text-gray-400" />
                        </div>
                        <div className="text-sm font-semibold text-gray-700">
                          No curriculum items found
                        </div>
                        <p className="max-w-sm text-xs text-gray-500">
                          {activeFilterCount > 0 || search
                            ? "Try adjusting your filters or search terms to find what you're looking for."
                            : "Get started by syncing from the Steps Library or creating a new lesson."}
                        </p>
                        {activeFilterCount > 0 || search ? (
                          <button
                            type="button"
                            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            onClick={() => { resetFilters(); setSearch(""); }}
                          >
                            Clear all filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((r) => (
                    <tr
                      key={r.id || `${r.refId}:${r.progressionStep}`}
                      className="group cursor-pointer transition-colors hover:bg-blue-50/40"
                      onClick={() => openDetails(r)}
                    >
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top text-xs text-gray-500">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-700 group-hover:bg-blue-100 group-hover:text-blue-800 transition-colors">
                          {r.refId || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-900 transition-colors">
                          {r.lessonTitle || "—"}
                        </div>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top text-sm text-gray-600">
                        {r.subject || "—"}
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top">
                        <span
                          className={[
                            "inline-flex max-w-[140px] items-center truncate whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-tight ring-1 ring-inset",
                            ageBadgeClass(r.childAge),
                          ].join(" ")}
                          title={r.childAge || ""}
                        >
                          {r.childAge || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top">
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                          {r.term || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top">
                        <span
                          className={[
                            "inline-flex max-w-[160px] items-center truncate whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-tight ring-1 ring-inset",
                            categoryBadgeClass(r.category),
                          ].join(" ")}
                        >
                          {displayCategory(r.category) || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top text-sm text-gray-700">
                        <div className="max-w-[200px] truncate" title={r.progressionStep}>
                          {r.progressionStep || "—"}
                        </div>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-3.5 align-top text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
                            onClick={() => openDetails(r)}
                            title="View details"
                          >
                            <IconEye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-60 transition-colors"
                            onClick={() => openEdit(r)}
                            disabled={saving || !r.id}
                            title="Edit"
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
                            onClick={() => openDuplicate(r)}
                            disabled={saving || !mainCenter?.id}
                            title="Duplicate"
                          >
                            <IconCopy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-60 transition-colors"
                            onClick={() => setDeleteTarget(r)}
                            disabled={!r.id}
                            title="Delete"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
            <div className="text-xs text-gray-500">
              Page <span className="font-semibold text-gray-800">{page}</span>{" "}
              of{" "}
              <span className="font-semibold text-gray-800">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                &larr; Prev
              </button>

              {buildPageItems(page, totalPages).map((it, idx) =>
                it.type === "dots" ? (
                  <span
                    key={`dots-${idx}`}
                    className="px-1.5 text-xs text-gray-400"
                  >
                    &hellip;
                  </span>
                ) : (
                  <button
                    key={`p-${it.value}`}
                    type="button"
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      it.value === page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100",
                    ].join(" ")}
                    onClick={() => setPage(it.value)}
                    disabled={loading}
                  >
                    {it.value}
                  </button>
                ),
              )}

              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {detailsOpen ? (
        <Modal
          title={
            detailsRecord?.progressionStep
              ? `${detailsRecord.progressionStep}`
              : "Lesson Details"
          }
          onClose={closeDetails}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex flex-wrap items-center gap-2">
              {detailsRecord?.refId ? (
                <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold text-gray-700">
                  {detailsRecord.refId}
                </span>
              ) : null}
              {detailsRecord?.childAge ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${ageBadgeClass(detailsRecord.childAge)}`}>
                  {detailsRecord.childAge}
                </span>
              ) : null}
              {detailsRecord?.category ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${categoryBadgeClass(detailsRecord.category)}`}>
                  {displayCategory(detailsRecord.category)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                onClick={() => {
                  closeDetails();
                  openEdit(detailsRecord);
                }}
                disabled={saving || !detailsRecord?.id}
              >
                <IconEdit className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                onClick={() => {
                  closeDetails();
                  openDuplicate(detailsRecord);
                }}
                disabled={saving || !mainCenter?.id}
              >
                <IconCopy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                onClick={() => {
                  closeDetails();
                  setDeleteTarget(detailsRecord);
                }}
                disabled={!detailsRecord?.id}
              >
                <IconTrash className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Lesson Info
                </div>
                <div className="text-base font-bold text-gray-900">
                  {detailsRecord?.lessonTitle || "—"}
                </div>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: "Subject", value: detailsRecord?.subject },
                    { label: "Term", value: detailsRecord?.term },
                    { label: "Sheet", value: detailsRecord?.sheet },
                    { label: "Time Required", value: detailsRecord?.timeRequired },
                    { label: "Setting", value: detailsRecord?.instructionalSetting },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline gap-2 text-sm">
                      <span className="flex-shrink-0 text-xs font-semibold text-gray-500 w-24">{label}</span>
                      <span className="text-gray-800">{value || "—"}</span>
                    </div>
                  ))}
                  {detailsRecord?.link ? (
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="flex-shrink-0 text-xs font-semibold text-gray-500 w-24">Link</span>
                      <a
                        href={detailsRecord.link}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-blue-600 hover:text-blue-700"
                      >
                        {detailsRecord.link}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Notes
                </div>
                <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                  {detailsRecord?.notes || <span className="italic text-gray-400">No notes</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Teacher Guide
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { label: "Introduction", value: detailsRecord?.introduction },
                { label: "Essential Questions", value: detailsRecord?.essentialQuestions },
                { label: "Key Vocabulary", value: detailsRecord?.keyVocabulary },
                { label: "Learning Activities", value: detailsRecord?.learningActivities },
                { label: "Accommodations/Modifications", value: detailsRecord?.accommodations },
                { label: "Notes to Teacher", value: detailsRecord?.notesToTeacher },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs font-semibold text-gray-700">{label}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                    {value || <span className="text-gray-500">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Lesson Assets
            </div>
            <div className="mt-2">
              <div className="text-xs font-semibold text-gray-700">
                Additional Resources
              </div>
              {detailsRecord?.lessonAttachment ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {splitResources(detailsRecord.lessonAttachment).map((r) => (
                    <li key={r}>
                      {isProbablyLink(r) ? (
                        <a
                          href={r}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {r}
                        </a>
                      ) : (
                        <span className="text-gray-800">{r}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-gray-600">—</div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Supplies List
            </div>
            {detailsRecord?.supplies?.length ? (
              <div className="mt-2 space-y-1.5">
                {detailsRecord.supplies.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm"
                  >
                    <span className="font-semibold text-gray-900">{s.name}</span>
                    <span className="text-gray-600">
                      x{s.quantity}
                      {s.unit ? ` ${s.unit}` : ""}
                      {" · "}
                      {s.quantityType === "per_student" ? "Per Student" : "Total"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-600">—</div>
            )}
          </div>
        </Modal>
      ) : null}

      {editOpen ? (
        <Modal
          title={
            editRecord?.progressionStep
              ? `Edit ${editRecord.progressionStep}`
              : "Edit Curriculum Lesson"
          }
          onClose={closeEdit}
        >
          <form onSubmit={saveEditRecord} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Lesson Title">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  placeholder="e.g. Sensory Exploration - Water"
                  disabled={saving}
                />
              </Field>

              <Field label="Reference ID (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  placeholder="e.g. 0y.D-CO.1.10"
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Child Age">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editChildAge}
                  onChange={(e) => setEditChildAge(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select an age group</option>
                  {lessonAgeOptions.map((ageOption) => (
                    <option key={ageOption} value={ageOption}>
                      {ageOption}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Manage age groups in{" "}
                  <a href="/admin/curriculum" className="font-semibold text-sky-700 hover:text-sky-800">
                    Steps of Progression Manager
                  </a>
                  {" "}under Categories.
                </p>
              </Field>
              <Field label="Term">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editTerm}
                  onChange={(e) => setEditTerm(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select a term</option>
                  {lessonTermOptions.map((termOption) => (
                    <option key={termOption} value={termOption}>
                      {termOption}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select a category</option>
                  {editCategoryOptions.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Subject (optional)">
                <input
                  list="edit-subject-options"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Type a subject"
                  disabled={saving}
                />
                <datalist id="edit-subject-options">
                  {editSubjectOptions.map((subjectOption) => (
                    <option key={subjectOption} value={subjectOption} />
                  ))}
                </datalist>
              </Field>
              <Field label="Progression Step (required)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editStep}
                  onChange={(e) => setEditStep(e.target.value)}
                  placeholder="e.g. Fine Motor Skills 1A"
                  required
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Link (optional)">
                <input
                  type="url"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  placeholder="https://…"
                  disabled={saving}
                />
              </Field>
              <Field label="Time Required (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editTimeRequired}
                  onChange={(e) => setEditTimeRequired(e.target.value)}
                  placeholder="e.g. 30 minutes"
                  disabled={saving}
                />
              </Field>
              <Field label="Instructional Setting (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editInstructionalSetting}
                  onChange={(e) => setEditInstructionalSetting(e.target.value)}
                  placeholder="e.g. Small group"
                  disabled={saving}
                />
              </Field>
            </div>

            <Field label="Introduction (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={editIntroduction}
                onChange={(e) => setEditIntroduction(e.target.value)}
                rows={2}
                disabled={saving}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Essential Questions (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editEssentialQuestions}
                  onChange={(e) => setEditEssentialQuestions(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
              <Field label="Key Vocabulary (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editKeyVocabulary}
                  onChange={(e) => setEditKeyVocabulary(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>

            <Field label="Learning Activities (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={editLearningActivities}
                onChange={(e) => setEditLearningActivities(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Accommodations/Modifications (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editAccommodations}
                  onChange={(e) => setEditAccommodations(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
              <Field label="Notes to Teacher (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editNotesToTeacher}
                  onChange={(e) => setEditNotesToTeacher(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>

            <SupplyRowsEditor rows={editSupplyRows} setRows={setEditSupplyRows} disabled={saving} />

            <Field label="Additional Resources (optional)">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                disabled={saving || uploadingResource}
                onChange={async (e) => {
                  const files = e.target.files;
                  await uploadAndAppendToField(
                    files,
                    editResource,
                    setEditResource,
                    setUploadingResource,
                  );
                  e.target.value = "";
                }}
              />
              {editResource ? (
                <ul className="mt-2 space-y-1">
                  {splitResources(editResource).map((r, i) => (
                    <li key={`${r}-${i}`} className="flex items-center justify-between gap-2">
                      <a href={r} target="_blank" rel="noreferrer" className="truncate text-xs text-blue-600 hover:text-blue-700">
                        {r}
                      </a>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-red-600 hover:text-red-700"
                        disabled={saving || uploadingResource}
                        onClick={() => {
                          const list = splitResources(editResource);
                          list.splice(i, 1);
                          setEditResource(list.join("\n"));
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {uploadingResource && (
                <div className="text-xs text-gray-500 mt-1">Uploading...</div>
              )}
            </Field>

            <Field label="Notes (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {createOpen ? (
        <Modal title="Create Curriculum Lesson" onClose={closeCreate}>
          <form onSubmit={saveNewRecord} className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Creates a new progression step (goal) under a lesson for{" "}
              <span className="font-semibold text-gray-900">
                {mainCenter?.name || "—"}
              </span>
              .
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Lesson Title">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="e.g. Sensory Exploration - Water"
                  disabled={saving}
                />
              </Field>

              <Field label="Reference ID (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="e.g. CUR-2024-001"
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Child Age">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newChildAge}
                  onChange={(e) => setNewChildAge(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select an age group</option>
                  {lessonAgeOptions.map((ageOption) => (
                    <option key={ageOption} value={ageOption}>
                      {ageOption}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Manage age groups in{" "}
                  <a href="/admin/curriculum" className="font-semibold text-sky-700 hover:text-sky-800">
                    Steps of Progression Manager
                  </a>
                  {" "}under Categories.
                </p>
              </Field>
              <Field label="Term">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select a term</option>
                  {lessonTermOptions.map((termOption) => (
                    <option key={termOption} value={termOption}>
                      {termOption}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select a category</option>
                  {newCategoryOptions.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Subject (optional)">
                <input
                  list="new-subject-options"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Type a subject"
                  disabled={saving}
                />
                <datalist id="new-subject-options">
                  {newSubjectOptions.map((subjectOption) => (
                    <option key={subjectOption} value={subjectOption} />
                  ))}
                </datalist>
              </Field>
              <Field label="Progression Step (required)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  placeholder="e.g. Fine Motor Skills 1A"
                  required
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Link (optional)">
                <input
                  type="url"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://…"
                  disabled={saving}
                />
              </Field>
              <Field label="Time Required (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newTimeRequired}
                  onChange={(e) => setNewTimeRequired(e.target.value)}
                  placeholder="e.g. 30 minutes"
                  disabled={saving}
                />
              </Field>
              <Field label="Instructional Setting (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newInstructionalSetting}
                  onChange={(e) => setNewInstructionalSetting(e.target.value)}
                  placeholder="e.g. Small group"
                  disabled={saving}
                />
              </Field>
            </div>

            <Field label="Introduction (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={newIntroduction}
                onChange={(e) => setNewIntroduction(e.target.value)}
                rows={2}
                disabled={saving}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Essential Questions (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newEssentialQuestions}
                  onChange={(e) => setNewEssentialQuestions(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
              <Field label="Key Vocabulary (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newKeyVocabulary}
                  onChange={(e) => setNewKeyVocabulary(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>

            <Field label="Learning Activities (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={newLearningActivities}
                onChange={(e) => setNewLearningActivities(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Accommodations/Modifications (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newAccommodations}
                  onChange={(e) => setNewAccommodations(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
              <Field label="Notes to Teacher (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newNotesToTeacher}
                  onChange={(e) => setNewNotesToTeacher(e.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>

            <SupplyRowsEditor rows={newSupplyRows} setRows={setNewSupplyRows} disabled={saving} />

            <Field label="Additional Resources (optional)">
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                disabled={saving || uploadingResource}
                onChange={async (e) => {
                  const files = e.target.files;
                  await uploadAndAppendToField(
                    files,
                    newResource,
                    setNewResource,
                    setUploadingResource,
                  );
                  e.target.value = "";
                }}
              />
              {newResource ? (
                <ul className="mt-2 space-y-1">
                  {splitResources(newResource).map((r, i) => (
                    <li key={`${r}-${i}`} className="flex items-center justify-between gap-2">
                      <a href={r} target="_blank" rel="noreferrer" className="truncate text-xs text-blue-600 hover:text-blue-700">
                        {r}
                      </a>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-red-600 hover:text-red-700"
                        disabled={saving || uploadingResource}
                        onClick={() => {
                          const list = splitResources(newResource);
                          list.splice(i, 1);
                          setNewResource(list.join("\n"));
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {uploadingResource && (
                <div className="text-xs text-gray-500 mt-1">Uploading...</div>
              )}
            </Field>

            <Field label="Notes (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                onClick={closeCreate}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {deleteTarget ? (
        <ConfirmDeleteDialog
          title="Delete Curriculum Record"
          message={`Are you sure you want to delete "${deleteTarget.progressionStep || deleteTarget.lessonTitle || "this record"}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      ) : null}

      {toast ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </AdminLayout>
  );
}
