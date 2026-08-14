import TeacherLayout from "@/components/teacher/TeacherLayout";
import { apiJson } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

const TYPE_LABELS = {
  DIAPER_CHANGE: "Diaper Change",
  NAP: "Nap",
  BOTTLE: "Bottle",
  MEAL: "Meal",
  SNACK: "Snack",
  ACTIVITY: "Activity",
  TASK_CHECKLIST: "Task Checklist",
  BEHAVIOR: "Citizenship",
  ACCOMPLISHMENT: "Accomplishment",
  INCIDENT: "Incident",
  TOILETING: "Toileting",
  OTHER: "Grade",
};

const MEAL_OCCASIONS = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "AM_SNACK", label: "AM snack" },
  { value: "LUNCH", label: "Lunch" },
  { value: "PM_SNACK", label: "PM snack" },
  { value: "DINNER", label: "Dinner" },
  { value: "EVENING_SNACK", label: "Evening snack" },
];

const PORTION_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "MOST", label: "Most" },
  { value: "SOME", label: "Some" },
  { value: "NONE", label: "None" },
];

const BEHAVIOR_TYPE_OPTIONS = [
  { value: "PHYSICAL_VIOLENCE", label: "Physical violence" },
  { value: "VIRTUE", label: "Virtue" },
  { value: "RESPECT", label: "Respect" },
  { value: "OBEDIENCE", label: "Obedience" },
  { value: "OTHER", label: "Other" },
];

const BEHAVIOR_LEVEL_OPTIONS = ["1", "2", "3", "4"];

const DIAPER_TYPE_OPTIONS = [
  { value: "BM", label: "BM" },
  { value: "W", label: "W" },
  { value: "D", label: "D" },
];

const TOILETING_TYPE_OPTIONS = [
  { value: "SUCCESS", label: "Success" },
  { value: "TRIED", label: "Tried" },
  { value: "ACCIDENT", label: "Accident" },
];

function supportsBehaviorDetails(type) {
  return type === "BEHAVIOR";
}

function supportsDirectGrade(type) {
  return type === "OTHER";
}

function toTimeInputValue(date) {
  const value = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(value.getTime())) return "";
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildCreatedAtForToday(timeValue) {
  const trimmed = String(timeValue || "").trim();
  if (!trimmed) return null;
  const [hoursRaw, minutesRaw] = trimmed.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const now = new Date();
  const value = new Date(now);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function defaultActivityFields(nextType) {
  return {
    activityTime: toTimeInputValue(new Date()),
    napStartTime: nextType === "NAP" ? toTimeInputValue(new Date()) : "",
    napEndTime: "",
    mealType: nextType === "SNACK" ? "AM_SNACK" : "BREAKFAST",
    quantity: "ALL",
    bottleQuantity: "",
    diaperType: "W",
    behaviorType: "OTHER",
    behaviorLevel: "1",
    toiletingType: "SUCCESS",
  };
}

const Icon = ({ className, children, viewBox = "0 0 24 24" }) => (
  <svg
    viewBox={viewBox}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
const Icons = {
  users: (props) => (
    <Icon {...props}>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M12 13c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5Z" />
    </Icon>
  ),
  building: (props) => (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M6 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
      <path d="M9 8h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2" />
    </Icon>
  ),
  filter: (props) => (
    <Icon {...props}>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </Icon>
  ),
  search: (props) => (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  ),
  list: (props) => (
    <Icon {...props}>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  ),
  note: (props) => (
    <Icon {...props}>
      <path d="M5 4h10l4 4v12H5z" />
      <path d="M15 4v4h4" />
    </Icon>
  ),
  sparkles: (props) => (
    <Icon {...props}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M5 18l.8 2.2L8 21l-2.2.8L5 24l-.8-2.2L2 21l2.2-.8L5 18Z" />
    </Icon>
  ),
  camera: (props) => (
    <Icon {...props}>
      <path d="M4 8h4l2-2h4l2 2h4v10H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </Icon>
  ),
  upload: (props) => (
    <Icon {...props}>
      <path d="M12 16V6" />
      <path d="M8 10l4-4 4 4" />
      <path d="M4 18h16" />
    </Icon>
  ),
  check: (props) => (
    <Icon {...props}>
      <path d="M5 12l4 4L19 6" />
    </Icon>
  ),
  info: (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </Icon>
  ),
};
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // keep in sync with /api/v1/uploads
const JPEG_QUALITIES = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48];

export default function TeacherLogs() {
  const router = useRouter();
  const toast = useToast();
  const initialCenterId =
    typeof router.query.centerId === "string" ? router.query.centerId : "";
  const initialChildId =
    typeof router.query.childId === "string" ? router.query.childId : "";

  const [centers, setCenters] = useState([]);
  const [children, setChildren] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [attendance, setAttendance] = useState(null);
  const [showClockedInOnly, setShowClockedInOnly] = useState(false);
  const [centerId, setCenterId] = useState(initialCenterId);
  const [childSearch, setChildSearch] = useState("");

  const [bulkChildIds, setBulkChildIds] = useState(() => (initialChildId ? [initialChildId] : []));

  const [type, setType] = useState("MEAL");
  const [activityFields, setActivityFields] = useState(() => defaultActivityFields("MEAL"));
  const [notes, setNotes] = useState("");
  const [dailyGrade, setDailyGrade] = useState("");
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
      setClasses([]);
      setAttendance(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [kids, cls, att] = await Promise.all([
        apiJson(`/api/v1/children?centerId=${encodeURIComponent(id)}`),
        apiJson(`/api/v1/classes?centerId=${encodeURIComponent(id)}`),
        apiJson(`/api/v1/attendance/today?centerId=${encodeURIComponent(id)}`).catch(() => null),
      ]);
      setChildren(Array.isArray(kids) ? kids : []);
      setClasses(Array.isArray(cls) ? cls : []);
      setAttendance(att);
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
      setBulkChildIds((prev) => (prev.includes(qChildId) ? prev : [...prev, qChildId]));
    }
  }, [router.isReady, router.query.centerId, router.query.childId]);

  useEffect(() => {
    setSuccess("");
    setClassId("");
    setShowClockedInOnly(false);
    setChildSearch("");
    loadChildren(centerId);
  }, [centerId]);

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

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  const clockedInChildIds = useMemo(() => {
    const set = new Set();
    for (const row of attendance?.checkedInChildren || []) {
      if (row?.child?.id) set.add(row.child.id);
    }
    return set;
  }, [attendance]);

  const sortedChildren = useMemo(() => {
    let list = children.slice();
    if (classId) {
      list = list.filter((c) => c.classRoomId === classId);
    }
    if (showClockedInOnly) {
      list = list.filter((c) => clockedInChildIds.has(c.id));
    }
    const query = String(childSearch || "").trim().toLowerCase();
    if (query) {
      list = list.filter((c) => {
        const full = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
        return full.includes(query);
      });
    }
    return list.sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children, classId, showClockedInOnly, clockedInChildIds, childSearch]);

  const centerLabel = useMemo(() => {
    const center = centers.find((c) => c.id === centerId);
    return center ? center.name : "";
  }, [centers, centerId]);

  const bulkSelectedSet = useMemo(
    () => new Set(bulkChildIds || []),
    [bulkChildIds],
  );

  const selectedMealOptions = useMemo(() => {
    if (type === "SNACK") {
      return MEAL_OCCASIONS.filter((option) => option.value.includes("SNACK"));
    }
    return MEAL_OCCASIONS;
  }, [type]);

  function handleTypeChange(nextType) {
    setType(nextType);
    setActivityFields((current) => {
      const defaults = defaultActivityFields(nextType);
      return {
        ...defaults,
        activityTime: current.activityTime || defaults.activityTime,
        napStartTime: nextType === "NAP" ? current.napStartTime || defaults.napStartTime : "",
        napEndTime: nextType === "NAP" ? current.napEndTime : "",
        diaperType: nextType === "DIAPER_CHANGE" ? current.diaperType || defaults.diaperType : defaults.diaperType,
        behaviorType: supportsBehaviorDetails(nextType) ? current.behaviorType || defaults.behaviorType : defaults.behaviorType,
        behaviorLevel: supportsBehaviorDetails(nextType) ? current.behaviorLevel || defaults.behaviorLevel : defaults.behaviorLevel,
        toiletingType: nextType === "TOILETING" ? current.toiletingType || defaults.toiletingType : defaults.toiletingType,
      };
    });
  }

  function updateActivityField(field, value) {
    setActivityFields((current) => ({ ...current, [field]: value }));
  }

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
    const gradeNum = dailyGrade === "" ? null : Number(dailyGrade);
    const hasDirectGrade =
      supportsDirectGrade(type) &&
      dailyGrade !== "" &&
      Number.isFinite(gradeNum);

    if (supportsDirectGrade(type)) {
      if (!hasDirectGrade) {
        throw new Error("Enter a grade from 0 to 10.");
      }
      if (gradeNum < 0 || gradeNum > 10) {
        throw new Error("Grade must be between 0 and 10.");
      }
    }

    const payloadType = type;

    let details = null;
    if (hasDirectGrade) {
      details = { kind: "DAILY_GRADE", grade: gradeNum };
    }

    const timeValue = activityFields.activityTime || toTimeInputValue(new Date());
    if (payloadType === "NAP") {
      details = {
        ...(details || {}),
        time: activityFields.napStartTime || activityFields.napEndTime || timeValue,
        startTime: activityFields.napStartTime || "",
        endTime: activityFields.napEndTime || "",
      };
    } else if (["MEAL", "SNACK"].includes(payloadType)) {
      const mealType =
        selectedMealOptions.find((option) => option.value === activityFields.mealType)?.label ||
        activityFields.mealType ||
        "";
      details = {
        ...(details || {}),
        time: timeValue,
        meal: mealType,
        mealType: activityFields.mealType,
        quantity: activityFields.quantity || "ALL",
      };
    } else if (payloadType === "BOTTLE") {
      details = {
        ...(details || {}),
        time: timeValue,
        quantity: activityFields.bottleQuantity || "",
      };
    } else if (payloadType === "DIAPER_CHANGE") {
      details = {
        ...(details || {}),
        time: timeValue,
        diaperType: activityFields.diaperType || "W",
      };
    } else if (payloadType === "BEHAVIOR") {
      details = {
        ...(details || {}),
        time: timeValue,
        behaviorType: activityFields.behaviorType || "OTHER",
        behaviorLevel: activityFields.behaviorLevel || "1",
      };
    } else if (payloadType === "TOILETING") {
      details = {
        ...(details || {}),
        time: timeValue,
        toiletingType: activityFields.toiletingType || "SUCCESS",
      };
    } else if (!supportsDirectGrade(type)) {
      details = {
        ...(details || {}),
        time: timeValue,
      };
    }

    if (photoUrls.length) {
      details = { ...(details || {}), media: photoUrls };
    }

    const createdAt =
      payloadType === "NAP"
        ? buildCreatedAtForToday(
            activityFields.napStartTime ||
              activityFields.napEndTime ||
              activityFields.activityTime,
          )
        : supportsDirectGrade(type)
          ? new Date()
          : buildCreatedAtForToday(activityFields.activityTime);

    return {
      payloadType,
      details,
      createdAt: createdAt ? createdAt.toISOString() : undefined,
    };
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
      const { payloadType, details, createdAt } = buildPayload(photoUrls);

      let ok = 0;
      const failures = [];
      for (const id of ids) {
        try {
          await apiJson("/api/v1/activities", {
            method: "POST",
            body: JSON.stringify({ childId: id, type: payloadType, notes, details, createdAt }),
          });
          ok += 1;
        } catch (e2) {
          failures.push(e2?.message || `Failed for childId=${id}`);
        }
      }

      setNotes("");
      setDailyGrade("");
      setActivityFields(defaultActivityFields(type));
      clearPhotos();
      setBulkChildIds([]);
      if (failures.length) {
        setError(
          `Bulk logging completed with errors (${ok}/${ids.length} succeeded): ${failures
            .slice(0, 3)
            .join(" - ")}`,
        );
      } else {
        toast.success(
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
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Daily Activity Logging</h2>
            <p className="mt-1 text-sm text-gray-600">
              Teachers can set the time for today's entry, but the date stays locked to today. Grade entries use a 0-10 score instead of a time. Select one or more children below to log at once.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {centerLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                <Icons.building className="h-3.5 w-3.5" />
                Center: {centerLabel}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <Icons.users className="h-3.5 w-3.5" />
              Selected: {bulkChildIds.length} child{bulkChildIds.length === 1 ? "" : "ren"}
            </span>
            {saving ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Icons.info className="h-3.5 w-3.5" />
                Saving...
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="flex items-center gap-2">
              <Icons.info className="h-4 w-4 text-red-500" />
              {error}
            </span>
            <button type="button" onClick={() => setError("")} className="ml-2 text-lg font-bold text-red-600 hover:text-red-800">&times;</button>
          </div>
        ) : null}

        <form
          onSubmit={submitBulk}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icons.users className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Step 1 - Select classroom and child
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Use filters and search to find the right child quickly.
                  </div>
                </div>
              </div>
              {centerId ? (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-1">
                    <Icons.users className="h-3.5 w-3.5 text-gray-500" />
                    Showing: {sortedChildren.length}/{children.length || 0}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                    <Icons.check className="h-3.5 w-3.5" />
                    Clocked in: {clockedInChildIds.size}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icons.building className="h-3.5 w-3.5" />
                  Center
                </div>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select a center...</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="block flex-1">
                  <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Icons.filter className="h-3.5 w-3.5" />
                    Classroom
                  </div>
                  <select
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setChildId("");
                      setBulkChildIds([]);
                    }}
                    disabled={!centerId || loading}
                  >
                    <option value="">All classrooms</option>
                    {classes
                      .slice()
                      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                      .map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showClockedInOnly}
                    onChange={(e) => {
                      setShowClockedInOnly(e.target.checked);
                      setChildId("");
                      setBulkChildIds([]);
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <Icons.check className="h-3.5 w-3.5 text-emerald-600" />
                    Clocked in only
                  </span>
                </label>
              </div>
              <label className="block md:col-span-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Search child
                </div>
                <div className="relative">
                  <Icons.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={childSearch}
                    onChange={(e) => setChildSearch(e.target.value)}
                    placeholder="Type a name to filter the list"
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-16 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    disabled={!centerId || loading}
                  />
                  {childSearch ? (
                    <button
                      type="button"
                      onClick={() => setChildSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>
            </div>

            <div className="mt-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
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
                        <span className="inline-flex items-center gap-1.5">
                          <Icons.check className="h-3.5 w-3.5" />
                          Select all
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={clearBulk}
                        disabled={saving || bulkChildIds.length === 0}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icons.info className="h-3.5 w-3.5" />
                          Clear
                        </span>
                      </button>
                    </div>
                  </div>

                  {!centerId ? (
                    <div className="mt-2 text-sm text-gray-600">Select a center first.</div>
                  ) : sortedChildren.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-600">No children match the filters.</div>
                  ) : (
                    <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
                      {sortedChildren.map((ch) => {
                        const checked = bulkSelectedSet.has(ch.id);
                        const isIn = clockedInChildIds.has(ch.id);
                        return (
                          <label
                            key={ch.id}
                            className={[
                              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
                              isIn ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white",
                            ].join(" ")}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {isIn && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                              <span className="truncate font-semibold text-gray-900">
                                {ch.firstName} {ch.lastName || ""}
                              </span>
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

                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                    <Icons.check className="h-3.5 w-3.5" />
                    Selected: {bulkChildIds.length}
                  </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <Icons.note className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Step 2 - Log details
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Choose an activity type and add a short note if needed.
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="block">
                <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icons.list className="h-3.5 w-3.5" />
                  Type
                </div>
                <div className="flex flex-wrap gap-2">
                  {["MEAL", "BOTTLE", "NAP", "DIAPER_CHANGE", "TOILETING", "ACTIVITY", "BEHAVIOR", "ACCOMPLISHMENT", "INCIDENT", "OTHER"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        type === t
                          ? "border-blue-200 bg-blue-50 text-blue-800"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {TYPE_LABELS[t] || t}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Use <span className="font-semibold">Grade</span> for a 0-10 score entry.
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icons.info className="h-3.5 w-3.5" />
                  Activity requirements
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {type === "NAP" ? (
                    <>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Start time
                        </div>
                        <input
                          type="time"
                          value={activityFields.napStartTime}
                          onChange={(e) => updateActivityField("napStartTime", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          End time
                        </div>
                        <input
                          type="time"
                          value={activityFields.napEndTime}
                          onChange={(e) => updateActivityField("napEndTime", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    </>
                  ) : supportsDirectGrade(type) ? (
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Grade
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="1"
                        value={dailyGrade}
                        onChange={(e) => setDailyGrade(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="0-10"
                      />
                    </label>
                  ) : (
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Time
                      </div>
                      <input
                        type="time"
                        value={activityFields.activityTime}
                        onChange={(e) => updateActivityField("activityTime", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  )}

                  {["MEAL", "SNACK"].includes(type) ? (
                    <>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Meal type
                        </div>
                        <select
                          value={activityFields.mealType}
                          onChange={(e) => updateActivityField("mealType", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          {selectedMealOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Quantity
                        </div>
                        <select
                          value={activityFields.quantity}
                          onChange={(e) => updateActivityField("quantity", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          {PORTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}

                  {type === "BOTTLE" ? (
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        # Ounces
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={activityFields.bottleQuantity}
                        onChange={(e) => updateActivityField("bottleQuantity", e.target.value)}
                        placeholder="e.g. 4"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  ) : null}

                  {type === "DIAPER_CHANGE" ? (
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Type
                      </div>
                      <select
                        value={activityFields.diaperType}
                        onChange={(e) => updateActivityField("diaperType", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        {DIAPER_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {type === "TOILETING" ? (
                    <label className="block">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Type
                      </div>
                      <select
                        value={activityFields.toiletingType}
                        onChange={(e) => updateActivityField("toiletingType", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        {TOILETING_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {supportsBehaviorDetails(type) ? (
                    <>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Type
                        </div>
                        <select
                          value={activityFields.behaviorType}
                          onChange={(e) => updateActivityField("behaviorType", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          {BEHAVIOR_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Level
                        </div>
                        <select
                          value={activityFields.behaviorLevel}
                          onChange={(e) => updateActivityField("behaviorLevel", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          {BEHAVIOR_LEVEL_OPTIONS.map((level) => (
                            <option key={level} value={level}>
                              Level {level}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  {type === "NAP"
                    ? "Nap entries can capture a start time, an end time, or both."
                    : ["MEAL", "SNACK"].includes(type)
                      ? "Meal entries capture the time, meal type, quantity, and description."
                      : type === "BOTTLE"
                        ? "Bottle entries capture the time, ounces, and description."
                        : type === "DIAPER_CHANGE"
                          ? "Diaper entries capture the time, diaper type, and description."
                          : type === "TOILETING"
                            ? "Toileting entries capture the time, type (success, tried, or accident), and description."
                            : type === "BEHAVIOR"
                            ? "Citizenship entries capture type, level, time, and description."
                            : type === "ACCOMPLISHMENT"
                              ? "Accomplishment entries capture the time and a description of what was achieved."
                              : supportsDirectGrade(type)
                                ? "Grade entries capture a 0-10 score and description."
                                : type === "INCIDENT"
                                  ? "Incident entries capture the time and description."
                                  : "Activity entries capture the time and description."}
                </div>
              </div>

              <label className="block md:col-span-2">
                <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icons.note className="h-3.5 w-3.5" />
                  Description
                </div>
                <textarea
                  className="min-h-[96px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    type === "NAP"
                      ? "Add a short rest-time note"
                      : ["MEAL", "SNACK", "BOTTLE"].includes(type)
                        ? "Add meal or feeding details"
                        : type === "INCIDENT"
                          ? "Describe the incident"
                        : "Add a short note about the activity"
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icons.camera className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Step 3 - Child photos (optional)
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Upload or capture photos. Large files will be optimized automatically.
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icons.upload className="h-3.5 w-3.5" />
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
                <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Icons.camera className="h-3.5 w-3.5" />
                  Take picture
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openCamera}
                    disabled={saving || cameraStarting || cameraOpen}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icons.camera className="h-4 w-4" />
                      {cameraStarting
                        ? "Starting..."
                        : cameraOpen
                          ? "Camera open"
                          : "Open camera"}
                    </span>
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
                    <span className="inline-flex items-center gap-2">
                      <Icons.upload className="h-4 w-4" />
                      Fallback picker
                    </span>
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
                <span className="inline-flex items-center gap-1.5">
                  <Icons.info className="h-3.5 w-3.5" />
                  Clear photos
                </span>
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
                    <span className="inline-flex items-center gap-2">
                      <Icons.camera className="h-4 w-4" />
                      Capture photo
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icons.info className="h-4 w-4" />
                      Stop camera
                    </span>
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
            {photoFiles.length ? (
              <div className="mt-1 text-xs text-amber-700">
                Selected photos will be attached to each selected child log.
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
                  <Icons.check className="h-4 w-4" />
                </span>
                {`Logging for ${bulkChildIds.length} child${bulkChildIds.length === 1 ? "" : "ren"}`}
                {photoFiles.length ? ` - ${photoFiles.length} photo(s)` : ""}
              </div>
              <button
                type="submit"
                disabled={saving || !centerId || bulkChildIds.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-2">
                  <Icons.check className="h-4 w-4" />
                  {saving ? "Saving..." : "Log Activity"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </TeacherLayout>
  );
}
