import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

const TYPES = [
  "DIAPER_CHANGE",
  "NAP",
  "BOTTLE",
  "MEAL",
  "SNACK",
  "ACTIVITY",
  "TASK_CHECKLIST",
  "BEHAVIOR",
  "OTHER",
];

const ASSESSMENT_DOMAINS = [
  {
    key: "cognitive",
    label: "Cognitive Development",
    description: "Problem-solving, curiosity, focus & memory",
    emoji: "\uD83E\uDDE0",
    color: "bg-violet-100 text-violet-700",
  },
  {
    key: "social",
    label: "Social-Emotional",
    description: "Sharing, empathy, self-regulation & cooperation",
    emoji: "\uD83E\uDD1D",
    color: "bg-sky-100 text-sky-700",
  },
  {
    key: "physical",
    label: "Physical Development",
    description: "Motor skills, coordination & physical activity",
    emoji: "\uD83C\uDFC3",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "language",
    label: "Language & Communication",
    description: "Vocabulary, expression, listening & comprehension",
    emoji: "\uD83D\uDCAC",
    color: "bg-amber-100 text-amber-700",
  },
  {
    key: "creative",
    label: "Creative Expression",
    description: "Art, music, imaginative play & self-expression",
    emoji: "\uD83C\uDFA8",
    color: "bg-rose-100 text-rose-700",
  },
];

const RUBRIC_LEVELS = [
  { value: 1, label: "Emerging", activeClass: "bg-amber-100 text-amber-800 border border-amber-300" },
  { value: 2, label: "Developing", activeClass: "bg-sky-100 text-sky-800 border border-sky-300" },
  { value: 3, label: "Proficient", activeClass: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  { value: 4, label: "Advanced", activeClass: "bg-violet-100 text-violet-800 border border-violet-300" },
];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // keep in sync with /api/v1/uploads
const JPEG_QUALITIES = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48];

export default function TeacherLogs() {
  const router = useRouter();
  const initialCenterId =
    typeof router.query.centerId === "string" ? router.query.centerId : "";
  const initialChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";

  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [centerId, setCenterId] = useState(initialCenterId);
  const [childId, setChildId] = useState(initialChildId);

  const [mode, setMode] = useState("single"); // single | bulk
  const [bulkChildIds, setBulkChildIds] = useState([]);

  const [type, setType] = useState("MEAL");
  const [notes, setNotes] = useState("");
  const [dailyGrade, setDailyGrade] = useState("");
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [domainScores, setDomainScores] = useState({});
  const [photoFiles, setPhotoFiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  async function loadCenters() {
    setLoading(true);
    setError("");
    try {
      const c = await apiJson("/api/v1/centers");
      setCenters(Array.isArray(c) ? c : []);
      if (!centerId && Array.isArray(c) && c.length === 1) {
        setCenterId(c[0].id);
      }
    } catch (e) {
      setError(e.message || "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }

  async function loadChildren(id) {
    if (!id) {
      setChildren([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kids = await apiJson(
        `/api/v1/children?centerId=${encodeURIComponent(id)}`,
      );
      setChildren(Array.isArray(kids) ? kids : []);
    } catch (e) {
      setError(e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCenters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const qCenterId =
      typeof router.query.centerId === "string" ? router.query.centerId : "";
    const qChildId =
      typeof router.query.childId === "string" ? router.query.childId : "";
    if (qCenterId) setCenterId(qCenterId);
    if (qChildId) {
      setMode("single");
      setChildId(qChildId);
    }
  }, [router.isReady, router.query.centerId, router.query.childId]);

  useEffect(() => {
    setSuccess("");
    loadChildren(centerId);
  }, [centerId]);

  useEffect(() => {
    if (!childId) return;
    const exists = children.some((c) => c.id === childId);
    if (!exists) setChildId("");
  }, [children, childId]);

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoFiles]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };
  }, []);

  const sortedChildren = useMemo(() => {
    return children
      .slice()
      .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children]);

  const childLabel = useMemo(() => {
    const ch = children.find((c) => c.id === childId);
    if (!ch) return "";
    return `${ch.firstName}${ch.lastName ? ` ${ch.lastName}` : ""}`;
  }, [children, childId]);

  const bulkSelectedSet = useMemo(
    () => new Set(bulkChildIds || []),
    [bulkChildIds],
  );

  function toggleBulkChild(id, next) {
    setBulkChildIds((prev) => {
      const set = new Set(prev || []);
      if (next) set.add(id);
      else set.delete(id);
      return [...set];
    });
  }

  function selectAllBulk() {
    setBulkChildIds(sortedChildren.map((c) => c.id));
  }

  function clearBulk() {
    setBulkChildIds([]);
  }

  function fileToBase64(file, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const timer = setTimeout(() => {
        try {
          reader.abort();
        } catch {}
        reject(new Error(`File read timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      reader.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Failed to read file"));
      };
      reader.onload = () => {
        clearTimeout(timer);
        const result = String(reader.result || "");
        const idx = result.indexOf(",");
        if (idx === -1) return reject(new Error("Invalid file encoding"));
        resolve(result.slice(idx + 1));
      };
      reader.onabort = () => {
        clearTimeout(timer);
        reject(new Error("File read aborted"));
      };
      reader.readAsDataURL(file);
    });
  }

  function canvasToBlob(canvas, type = "image/jpeg", quality = 0.82) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || null), type, quality);
    });
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Invalid image file"));
      };
      img.src = url;
    });
  }

  function toJpegName(name) {
    const raw = String(name || "photo").replace(/\.[^.]+$/, "");
    return `${raw}.jpg`;
  }

  async function optimizeImageForUpload(file) {
    if (!file || !String(file.type || "").startsWith("image/")) return null;
    if (Number(file.size || 0) <= MAX_PHOTO_BYTES) return file;

    const image = await loadImageFromFile(file);
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Could not read image dimensions");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");

    const maxSides = [2560, 2200, 1920, 1600, 1280];
    for (const maxSide of maxSides) {
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      for (const quality of JPEG_QUALITIES) {
        const blob = await canvasToBlob(canvas, "image/jpeg", quality);
        if (!blob) continue;
        if (blob.size <= MAX_PHOTO_BYTES) {
          return new File([blob], toJpegName(file.name), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }
    }

    return null;
  }

  function onSelectPhotos(list) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    setPhotoFiles((prev) => {
      const map = new Map();
      for (const f of [...prev, ...incoming]) {
        const key = `${f.name}:${f.size}:${f.lastModified}`;
        if (!map.has(key)) map.set(key, f);
      }
      return [...map.values()].slice(0, 10);
    });
  }

  function clearPhotos() {
    setPhotoFiles([]);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    closeCamera();
  }

  function removePhotoAt(index) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function openCamera() {
    if (cameraOpen || cameraStarting) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError("Camera is not supported in this browser. Use Upload photos instead.");
      return;
    }
    setCameraStarting(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (e) {
      setError(e?.message || "Could not open camera. Check camera permissions.");
      setCameraOpen(false);
    } finally {
      setCameraStarting(false);
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }

  function capturePhotoFromCamera() {
    const video = videoRef.current;
    if (!video) return;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (!width || !height) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onSelectPhotos([file]);
      },
      "image/jpeg",
      0.92,
    );
  }

  async function uploadPhotoUrls() {
    const files = Array.isArray(photoFiles) ? photoFiles : [];
    if (!files.length) return { urls: [], warning: "" };
    const uploaded = [];
    const warnings = [];
    const notices = [];
    for (const file of files) {
      try {
        let uploadFile = file;
        if (Number(file?.size || 0) > MAX_PHOTO_BYTES) {
          const optimized = await optimizeImageForUpload(file);
          if (!optimized) {
            warnings.push(`${file.name}: exceeds 10MB limit`);
            continue;
          }
          uploadFile = optimized;
          notices.push(`${file.name} optimized for upload`);
        }

        const dataBase64 = await fileToBase64(uploadFile, 12000);
        const res = await apiJson("/api/v1/uploads", {
          method: "POST",
          timeoutMs: 25000,
          body: JSON.stringify({
            filename: uploadFile.name,
            mimeType: uploadFile.type,
            dataBase64,
          }),
        });
        if (res?.url) uploaded.push(res.url);
        else warnings.push(`${uploadFile.name}: upload did not return URL`);
      } catch (e) {
        warnings.push(`${file.name}: ${e?.message || "upload failed"}`);
      }
    }
    const parts = [];
    if (notices.length) {
      parts.push(`Optimized ${notices.length} large photo(s).`);
    }
    if (warnings.length) {
      parts.push(`Some photos were skipped (${warnings.slice(0, 2).join("; ")}).`);
    }
    const warning = parts.join(" ");
    return { urls: uploaded, warning };
  }

  function buildPayload(photoUrls = []) {
    const hasDomainScores = Object.keys(domainScores).length > 0;
    const gradeNum = dailyGrade === "" ? null : Number(dailyGrade);
    const hasLegacyGrade = dailyGrade !== "" && Number.isFinite(gradeNum);
    const hasGrade = hasDomainScores || hasLegacyGrade;
    const payloadType = hasGrade ? "OTHER" : type;

    let details = null;
    if (hasDomainScores) {
      // Compute overall average from domain scores (1-4 scale)
      const scores = Object.values(domainScores).filter((v) => v > 0);
      const avg = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null;
      // Map 1-4 domain scale to 1-5 legacy scale for backward compat
      const legacyGrade = avg !== null ? Math.round((avg / 4) * 5) : null;
      details = {
        kind: "DAILY_GRADE",
        grade: legacyGrade,
        domains: { ...domainScores },
        domainAvg: avg,
      };
    } else if (hasLegacyGrade) {
      details = { kind: "DAILY_GRADE", grade: gradeNum };
    }

    if (photoUrls.length) {
      details = { ...(details || {}), media: photoUrls };
    }
    return { payloadType, details };
  }

  async function submitSingle(e) {
    e.preventDefault();
    if (!childId) {
      setError("Please select a child.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { urls: photoUrls, warning } = await uploadPhotoUrls();
      const { payloadType, details } = buildPayload(photoUrls);
      await apiJson("/api/v1/activities", {
        method: "POST",
        body: JSON.stringify({ childId, type: payloadType, notes, details }),
      });
      setNotes("");
      setDailyGrade("");
      setDomainScores({});
      setAssessmentOpen(false);
      clearPhotos();
      setSuccess(
        warning
          ? `Logged ${payloadType} for ${childLabel || "child"}. ${warning}`
          : `Logged ${payloadType} for ${childLabel || "child"}.`,
      );
    } catch (e2) {
      setError(e2.message || "Failed to log activity");
    } finally {
      setSaving(false);
    }
  }

  async function submitBulk(e) {
    e.preventDefault();
    const ids = Array.isArray(bulkChildIds) ? bulkChildIds.filter(Boolean) : [];
    if (!ids.length) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { urls: photoUrls, warning } = await uploadPhotoUrls();
      const { payloadType, details } = buildPayload(photoUrls);

      let ok = 0;
      const failures = [];
      for (const id of ids) {
        try {
          await apiJson("/api/v1/activities", {
            method: "POST",
            body: JSON.stringify({ childId: id, type: payloadType, notes, details }),
          });
          ok += 1;
        } catch (e2) {
          failures.push(e2?.message || `Failed for childId=${id}`);
        }
      }

      setNotes("");
      setDailyGrade("");
      setDomainScores({});
      setAssessmentOpen(false);
      clearPhotos();
      setBulkChildIds([]);
      if (failures.length) {
        setError(
          `Bulk logging completed with errors (${ok}/${ids.length} succeeded): ${failures
            .slice(0, 3)
            .join(" • ")}`,
        );
      } else {
        setSuccess(
          warning
            ? `Bulk logged ${payloadType} for ${ok} children. ${warning}`
            : `Bulk logged ${payloadType} for ${ok} children.`,
        );
      }
    } catch (e2) {
      setError(e2.message || "Failed to bulk log activity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TeacherLayout title="Activity Logging">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Daily Activity Logging</h2>
        <p className="mt-1 text-sm text-gray-600">
          Teachers cannot backdate activity logs. Bulk logging is supported.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {success}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("single");
              setSuccess("");
              setError("");
            }}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              mode === "single"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Single child
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("bulk");
              setSuccess("");
              setError("");
              setChildId("");
            }}
            className={[
              "rounded-xl px-3 py-2 text-sm font-extrabold",
              mode === "bulk"
                ? "bg-sky-100 text-sky-900"
                : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
            ].join(" ")}
          >
            Bulk logging
          </button>
        </div>

        <form
          onSubmit={mode === "bulk" ? submitBulk : submitSingle}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Center
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {mode === "single" ? (
            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Child
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                disabled={!centerId || loading}
                required
              >
                <option value="">Select a child…</option>
                {sortedChildren.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.firstName} {ch.lastName || ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:row-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Children (bulk)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllBulk}
                    disabled={!centerId || loading || saving || sortedChildren.length === 0}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearBulk}
                    disabled={saving || bulkChildIds.length === 0}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {!centerId ? (
                <div className="mt-2 text-sm text-gray-600">Select a center first.</div>
              ) : sortedChildren.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">No children found.</div>
              ) : (
                <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
                  {sortedChildren.map((ch) => {
                    const checked = bulkSelectedSet.has(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-semibold text-gray-900">
                          {ch.firstName} {ch.lastName || ""}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleBulkChild(ch.id, e.target.checked)}
                          disabled={saving}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 text-xs text-gray-600">
                Selected: {bulkChildIds.length}
              </div>
            </div>
          )}

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Type
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-gray-600">
              Daily grade uses type <span className="font-semibold">OTHER</span> automatically.
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notes (optional)
            </div>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short note"
            />
          </label>

          {/* Developmental Assessment Panel */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
            <button
              type="button"
              onClick={() => setAssessmentOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Developmental Assessment (optional)
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {Object.keys(domainScores).length > 0
                    ? `${Object.keys(domainScores).length} domain(s) rated`
                    : "Rate child across developmental domains"}
                </div>
              </div>
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 text-gray-400 transition ${assessmentOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {assessmentOpen && (
              <div className="mt-3 space-y-3">
                {ASSESSMENT_DOMAINS.map((domain) => {
                  const current = domainScores[domain.key] || 0;
                  return (
                    <div key={domain.key} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs ${domain.color}`}>
                          {domain.emoji}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{domain.label}</div>
                          <div className="text-xs text-gray-500">{domain.description}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {RUBRIC_LEVELS.map((level) => (
                          <button
                            key={level.value}
                            type="button"
                            onClick={() =>
                              setDomainScores((prev) => {
                                const next = { ...prev };
                                if (next[domain.key] === level.value) {
                                  delete next[domain.key];
                                } else {
                                  next[domain.key] = level.value;
                                }
                                return next;
                              })
                            }
                            className={[
                              "rounded-lg px-2 py-1.5 text-xs font-semibold transition",
                              current === level.value
                                ? level.activeClass
                                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {Object.keys(domainScores).length > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <div className="text-xs text-sky-800">
                      <span className="font-semibold">Overall: </span>
                      {(() => {
                        const scores = Object.entries(domainScores);
                        const avg = scores.reduce((s, [, v]) => s + v, 0) / scores.length;
                        const level = RUBRIC_LEVELS.find((l) => l.value === Math.round(avg));
                        return level ? level.label : `${avg.toFixed(1)}/4`;
                      })()}
                      <span className="ml-2 text-sky-600">
                        ({Object.keys(domainScores).length}/{ASSESSMENT_DOMAINS.length} domains)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDomainScores({})}
                      className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Child photos (upload or take picture)
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Upload photos
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onSelectPhotos(e.target.files)}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Take picture
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openCamera}
                    disabled={saving || cameraStarting || cameraOpen}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cameraStarting
                      ? "Starting..."
                      : cameraOpen
                        ? "Camera open"
                        : "Open camera"}
                  </button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => onSelectPhotos(e.target.files)}
                    disabled={saving}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Fallback picker
                  </button>
                </div>
              </label>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="text-xs text-gray-600">
                {photoFiles.length
                  ? `${photoFiles.length} photo(s) selected`
                  : "No photos selected"}
              </div>
              <button
                type="button"
                onClick={clearPhotos}
                disabled={saving || photoFiles.length === 0}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear photos
              </button>
            </div>
            {cameraOpen ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-2">
                <video
                  ref={videoRef}
                  className="max-h-72 w-full rounded-lg bg-black object-contain"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Capture photo
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Stop camera
                  </button>
                </div>
              </div>
            ) : null}
            {photoPreviewUrls.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {photoPreviewUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    <img
                      src={url}
                      alt={`Selected child photo ${idx + 1}`}
                      className="h-28 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhotoAt(idx)}
                      disabled={saving}
                      className="w-full border-t border-gray-200 px-2 py-1 text-xs font-extrabold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {mode === "bulk" && photoFiles.length ? (
              <div className="mt-1 text-xs text-amber-700">
                Selected photos will be attached to each selected child log.
              </div>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={
                saving ||
                !centerId ||
                (mode === "single" ? !childId : bulkChildIds.length === 0)
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "bulk" ? "Bulk Log Activity" : "Log Activity"}
            </button>
          </div>
        </form>
      </div>
    </TeacherLayout>
  );
}
