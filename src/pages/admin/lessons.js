import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
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

function byNaturalString(a, b) {
  return naturalCollator.compare(normalizeSpaces(a), normalizeSpaces(b));
}

const REF_DOMAIN_ORDER = new Map([
  ["S", 0], // Spiritual
  ["D", 1], // Development
  ["A", 2], // Academics
  ["L", 3], // Life Skills
]);

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

function splitResources(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|\n|;)\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
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
    return "bg-violet-50 text-violet-800 ring-violet-200";
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

function StatCard({ label, value, sublabel }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-gray-900">{value}</div>
      {sublabel ? (
        <div className="mt-1 text-xs text-gray-500">{sublabel}</div>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold text-gray-900">
              {title}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
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

export default function AdminLessons() {
  const [centers, setCenters] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [uploadingAdditionalResources, setUploadingAdditionalResources] =
    useState(false);
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
  const [editAdditionalResources, setEditAdditionalResources] = useState("");
  const [editNotes, setEditNotes] = useState("");

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
  const [newAdditionalResources, setNewAdditionalResources] = useState("");
  const [newNotes, setNewNotes] = useState("");

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

  useEffect(() => {
    refreshCenters();
  }, [refreshCenters]);

  useEffect(() => {
    refreshLessons();
  }, [refreshLessons]);

  const records = useMemo(() => {
    const out = [];
    for (const lesson of Array.isArray(lessons) ? lessons : []) {
      for (const goal of Array.isArray(lesson?.goals) ? lesson.goals : []) {
        const pc = goal?.passingCriteria || {};
        out.push({
          id: goal?.id,
          refId: String(pc.reference ?? ""),
          lessonTitle: String(pc.lesson ?? lesson?.title ?? ""),
          subject: normalizeSubjectForRef({
            subject: String(pc.subject ?? ""),
            refId: String(pc.reference ?? ""),
          }),
          childAge: String(pc.age ?? ""),
          term: String(pc.term ?? ""),
          category: String(pc.category ?? lesson?.category?.name ?? ""),
          progressionStep: String(pc.stepOfProgression ?? goal?.title ?? ""),
          testingQuestion: String(
            pc.testingQuestion ?? goal?.description ?? "",
          ),
          resource: String(pc.resource ?? ""),
          additionalResources: String(pc.additionalResources ?? ""),
          notes: String(pc.notes ?? ""),
          sheet: String(pc.sheet ?? ""),
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

  const subjectOptions = useMemo(() => {
    const ageKey = normalizeSpaces(age);
    const catKey = normalizeSpaces(category);
    const termKey = normalizeSpaces(term);
    const subjects = new Set();

    for (const r of records) {
      if (ageKey && normalizeSpaces(r.childAge) !== ageKey) continue;
      if (catKey && normalizeSpaces(r.category) !== catKey) continue;
      if (termKey && normalizeSpaces(r.term) !== termKey) continue;
      if (r.subject) subjects.add(r.subject);
    }

    return [...subjects].sort((a, b) => byString(a, b));
  }, [records, age, category, term]);

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
    const lessonSet = new Set();
    const termSet = new Set();
    const catCounts = new Map();

    for (const r of records) {
      if (r.lessonTitle) lessonSet.add(normalizeKey(r.lessonTitle));
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
      totalLessons: lessonSet.size,
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
  }, [records]);

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
    setEditTerm(String(rec?.term || ""));
    setEditCategory(String(rec?.category || ""));
    setEditSubject(String(rec?.subject || ""));
    setEditReference(String(rec?.refId || ""));
    setEditStep(String(rec?.progressionStep || ""));
    setEditTestingQuestion(String(rec?.testingQuestion || ""));
    setEditResource(String(rec?.resource || ""));
    setEditAdditionalResources(String(rec?.additionalResources || ""));
    setEditNotes(String(rec?.notes || ""));
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
    setNewAdditionalResources("");
    setNewNotes("");
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
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
            term: normalizeSpaces(newTerm),
            category: normalizeSpaces(newCategory),
            subject: normalizeSubjectForRef({
              subject: normalizeSpaces(newSubject),
              refId: normalizeSpaces(newReference),
            }),
            reference: normalizeSpaces(newReference),
            progressionStep: step,
            testingQuestion: String(newTestingQuestion || ""),
            resource: String(newResource || ""),
            additionalResources: String(newAdditionalResources || ""),
            notes: String(newNotes || ""),
          }),
        });
        setCreateOpen(false);
        await refreshLessons();
      } catch (e2) {
        setError(e2.message || "Failed to create record");
      } finally {
        setSaving(false);
      }
    },
    [
      mainCenter?.id,
      newAdditionalResources,
      newCategory,
      newChildAge,
      newLessonTitle,
      newNotes,
      newReference,
      newResource,
      newStep,
      newSubject,
      newTerm,
      newTestingQuestion,
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
              term: normalizeSpaces(editTerm),
              category: normalizeSpaces(editCategory),
              subject: normalizeSubjectForRef({
                subject: normalizeSpaces(editSubject),
                refId: normalizeSpaces(editReference),
              }),
              reference: normalizeSpaces(editReference),
              progressionStep: step,
              testingQuestion: String(editTestingQuestion || ""),
              resource: String(editResource || ""),
              additionalResources: String(editAdditionalResources || ""),
              notes: String(editNotes || ""),
            }),
          },
        );
        setEditOpen(false);
        setEditRecord(null);
        await refreshLessons();
      } catch (err) {
        setError(err.message || "Failed to save changes");
      } finally {
        setSaving(false);
      }
    },
    [
      editAdditionalResources,
      editCategory,
      editChildAge,
      editLessonTitle,
      editNotes,
      editRecord?.id,
      editReference,
      editResource,
      editStep,
      editSubject,
      editTerm,
      editTestingQuestion,
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

  return (
    <AdminLayout title="Curriculum Lessons">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900">
              Curriculum Lessons
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage early childhood development modules and tracking.
            </p>
            <div className="mt-1 text-xs text-gray-500">
              Center:{" "}
              <span className="font-semibold text-gray-800">
                {mainCenter?.name || "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
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
                    "Testing Question",
                    "Resource",
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
                    r.testingQuestion,
                    r.resource,
                    r.additionalResources,
                    r.notes,
                    r.sheet,
                  ]),
                })
              }
              disabled={loading || filtered.length === 0}
            >
              <IconDownload className="h-4 w-4 text-gray-600" />
              Export CSV
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={openCreate}
              disabled={loading || !mainCenter?.id}
            >
              <IconPlus className="h-4 w-4" />
              Create New Lesson
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
              onClick={runImport}
              disabled={importing || loading || !mainCenter?.id}
              title="Import/refresh curriculum from public/uploads/StepsofProgressionLibrary.xlsx"
            >
              <IconRefresh className="h-4 w-4 text-gray-600" />
              {importing ? "Syncing..." : "Sync from Steps Library"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {importResult?.totals ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <div className="font-semibold">Sync complete</div>
            <div className="mt-1 text-blue-800">
              Centers: {importResult.totals.centers} • Rows imported:{" "}
              {importResult.totals.rowsImported} • Categories created:{" "}
              {importResult.totals.categoriesCreated} • Lessons created:{" "}
              {importResult.totals.lessonsCreated} • Lessons updated:{" "}
              {importResult.totals.lessonsUpdated} • Goals created:{" "}
              {importResult.totals.goalsCreated}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard
            label="Total Lessons"
            value={stats.totalLessons.toLocaleString()}
            sublabel={`${stats.totalRecords.toLocaleString()} progression steps`}
          />
          <StatCard
            label="Active Terms"
            value={stats.activeTerms.toLocaleString()}
            sublabel="Distinct terms found"
          />
          <StatCard
            label={`${stats.secondary.label} Modules`}
            value={Number(stats.secondary.count || 0).toLocaleString()}
          />
          <StatCard
            label={`${stats.tertiary.label} Modules`}
            value={Number(stats.tertiary.count || 0).toLocaleString()}
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            <label className="block md:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Search lesson title or ID...
              </div>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                disabled={loading}
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Child Age
              </div>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={loading}
              >
                <option value="">All</option>
                {options.ages.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Category
              </div>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              >
                <option value="">All</option>
                {options.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Term
              </div>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading}
              >
                <option value="">All</option>
                {options.terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Subject
              </div>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
              >
                <option value="">All</option>
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
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                onClick={resetFilters}
                disabled={loading}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="text-xs text-gray-600">
              Showing{" "}
              <span className="font-semibold text-gray-900">
                {filtered.length ? (page - 1) * pageSize + 1 : 0}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-gray-900">
                {Math.min(page * pageSize, filtered.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900">
                {filtered.length.toLocaleString()}
              </span>{" "}
              results
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-semibold uppercase tracking-wide text-gray-500">
                Page size
              </span>
              <select
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
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
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-sm text-gray-600"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-gray-600"
                    >
                      No curriculum items found. Try syncing from the Steps
                      Library or adjusting filters.
                    </td>
                  </tr>
                ) : (
                  paged.map((r) => (
                    <tr key={r.id || `${r.refId}:${r.progressionStep}`}>
                      <td className="border-t border-gray-100 px-4 py-4 align-top text-xs text-gray-500">
                        <div className="font-semibold text-gray-700">
                          {r.refId || "—"}
                        </div>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top">
                        <div className="text-sm font-extrabold text-gray-900">
                          {r.lessonTitle || "—"}
                        </div>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top text-sm text-gray-700">
                        {r.subject || "—"}
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top">
                        <span
                          className={[
                            "inline-flex max-w-[140px] items-center truncate whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight ring-1 ring-inset",
                            ageBadgeClass(r.childAge),
                          ].join(" ")}
                          title={r.category || ""}
                        >
                          {r.childAge || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top text-sm text-gray-700">
                        {r.term || "—"}
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top">
                        <span
                          className={[
                            "inline-flex max-w-[160px] items-center truncate whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight ring-1 ring-inset",
                            categoryBadgeClass(r.category),
                          ].join(" ")}
                        >
                          {displayCategory(r.category) || "—"}
                        </span>
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top text-sm text-gray-700">
                        {r.progressionStep || "—"}
                      </td>
                      <td className="border-t border-gray-100 px-4 py-4 align-top text-right">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                            onClick={() => openEdit(r)}
                            disabled={saving || !r.id}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            onClick={() => openDetails(r)}
                          >
                            View Details
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
            <div className="text-xs text-gray-600">
              Page <span className="font-semibold text-gray-900">{page}</span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                Prev
              </button>

              {buildPageItems(page, totalPages).map((it, idx) =>
                it.type === "dots" ? (
                  <span
                    key={`dots-${idx}`}
                    className="px-2 text-xs text-gray-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={`p-${it.value}`}
                    type="button"
                    className={[
                      "rounded-lg px-2 py-1 text-xs font-semibold",
                      it.value === page
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
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
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {detailsOpen ? (
        <Modal
          title={
            detailsRecord?.progressionStep
              ? `Details — ${detailsRecord.progressionStep}`
              : "Details"
          }
          onClose={closeDetails}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
              onClick={() => {
                closeDetails();
                openEdit(detailsRecord);
              }}
              disabled={saving || !detailsRecord?.id}
            >
              Edit
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Lesson
              </div>
              <div className="mt-1 text-sm font-extrabold text-gray-900">
                {detailsRecord?.lessonTitle || "—"}
              </div>
              <div className="mt-2 text-sm text-gray-700">
                <div>
                  <span className="font-semibold text-gray-900">Ref ID:</span>{" "}
                  {detailsRecord?.refId || "—"}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-900">
                    Child Age:
                  </span>{" "}
                  {detailsRecord?.childAge || "—"}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-900">Term:</span>{" "}
                  {detailsRecord?.term || "—"}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-900">Category:</span>{" "}
                  {detailsRecord?.category || "—"}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-900">Subject:</span>{" "}
                  {detailsRecord?.subject || "—"}
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-gray-900">Sheet:</span>{" "}
                  {detailsRecord?.sheet || "—"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Testing Question
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                {detailsRecord?.testingQuestion || "—"}
              </div>

              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                {detailsRecord?.notes || "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Resources
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-gray-700">
                  Resource
                </div>
                {detailsRecord?.resource ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {splitResources(detailsRecord.resource).map((r) => (
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

              <div>
                <div className="text-xs font-semibold text-gray-700">
                  Additional Resources
                </div>
                {detailsRecord?.additionalResources ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {splitResources(detailsRecord.additionalResources).map(
                      (r) => (
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
                      ),
                    )}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-gray-600">—</div>
                )}
              </div>
            </div>
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
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editChildAge}
                  onChange={(e) => setEditChildAge(e.target.value)}
                  placeholder="e.g. 0-6 Months"
                  disabled={saving}
                />
              </Field>
              <Field label="Term">
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editTerm}
                  onChange={(e) => setEditTerm(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select a term</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                  <option value="4">Term 4</option>
                  <option value="5">Term 5</option>
                </select>
              </Field>
              <Field label="Category">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="e.g. Cognitive"
                  list="category-options"
                  disabled={saving}
                />
                <datalist id="category-options">
                  {options.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Subject (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="e.g. Science & Exploration"
                  disabled={saving}
                />
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

            <Field label="Testing Question (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={editTestingQuestion}
                onChange={(e) => setEditTestingQuestion(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </Field>

            <div className="flex flex-col md:flex-row md:space-x-4 space-y-3 md:space-y-0">
              {/* Resource */}
              <Field label="Resource (optional)" className="flex-1">
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
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
                {uploadingResource && (
                  <div className="text-xs text-gray-500 mt-1">Uploading...</div>
                )}
              </Field>

              {/* Additional Resources */}
              <Field label="Additional Resources (optional)" className="flex-1">
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  disabled={saving || uploadingAdditionalResources}
                  onChange={async (e) => {
                    const files = e.target.files;
                    await uploadAndAppendToField(
                      files,
                      editAdditionalResources,
                      setEditAdditionalResources,
                      setUploadingAdditionalResources,
                    );
                    e.target.value = "";
                  }}
                />
                {uploadingAdditionalResources && (
                  <div className="text-xs text-gray-500 mt-1">Uploading...</div>
                )}
              </Field>
            </div>

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
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newChildAge}
                  onChange={(e) => setNewChildAge(e.target.value)}
                  placeholder="e.g. 0-6 Months"
                  disabled={saving}
                />
              </Field>
              <Field label="Term">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="e.g. Term 1"
                  disabled={saving}
                />
              </Field>
              <Field label="Category">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Cognitive"
                  list="category-options"
                  disabled={saving}
                />
                <datalist id="category-options">
                  {options.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Subject (optional)">
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Science & Exploration"
                  disabled={saving}
                />
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

            <Field label="Testing Question (optional)">
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                value={newTestingQuestion}
                onChange={(e) => setNewTestingQuestion(e.target.value)}
                rows={3}
                disabled={saving}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Resource (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newResource}
                  onChange={(e) => setNewResource(e.target.value)}
                  rows={3}
                  placeholder="Links or text..."
                  disabled={saving}
                />
              </Field>
              <Field label="Additional Resources (optional)">
                <textarea
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={newAdditionalResources}
                  onChange={(e) => setNewAdditionalResources(e.target.value)}
                  rows={3}
                  placeholder="Links or text..."
                  disabled={saving}
                />
              </Field>
            </div>

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
    </AdminLayout>
  );
}
