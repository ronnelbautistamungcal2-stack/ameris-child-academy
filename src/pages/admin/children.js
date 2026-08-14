import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { childAgeGroup, ageInMonths } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import { FLAG_CATEGORY_OPTIONS } from "@/lib/childFlags";
import { userRoles } from "@/lib/roles";
import {
  getLinkedParentIds,
  getLinkedParentUsers,
  MAX_LINKED_PARENT_ACCOUNTS,
} from "@/lib/child-parent-links";
import {
  MAX_EMERGENCY_CONTACTS,
  MAX_PARENT_CONTACTS,
  formatContactLine,
  getEmergencyContacts,
  getParentContacts,
} from "@/lib/child-contacts";
import { useToast } from "@/contexts/ToastContext";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

function createParentContacts(value = []) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: MAX_PARENT_CONTACTS }, (_, index) => {
    const item = source[index] && typeof source[index] === "object" ? source[index] : {};
    return {
      label: item.label || `Parent ${index + 1}`,
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
    };
  });
}

function createParentAccountIds(value = []) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    { length: MAX_LINKED_PARENT_ACCOUNTS },
    (_, index) => source[index] || "",
  );
}

function createEmergencyContacts(value = []) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: MAX_EMERGENCY_CONTACTS }, (_, index) => {
    const item = source[index] && typeof source[index] === "object" ? source[index] : {};
    return {
      label: item.label || `Emergency ${index + 1}`,
      name: item.name || "",
      phone: item.phone || "",
    };
  });
}

function childFullName(child) {
  return `${child?.firstName || ""} ${child?.lastName || ""}`.trim() || "Unnamed child";
}

function formatLinkedParentAccount(parent) {
  return parent?.email || parent?.name || parent?.id || "";
}

function getDefaultClassRoomId(child) {
  return child?.defaultClassRoomId ?? child?.classRoomId ?? "";
}

function getEffectiveClassRoomId(child) {
  return child?.effectiveClassRoomId ?? getDefaultClassRoomId(child);
}

function isChildCheckedInToday(child) {
  return !!child?.todayAttendance?.checkedInAt && !child?.todayAttendance?.checkedOutAt;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CHILD_DOCUMENT_TYPES = [
  { field: "healthAssessmentDocuments", label: "Health Assessment", setter: "setHealthAssessmentDocuments", filesSetter: "setHealthAssessmentFiles" },
  { field: "enrollmentDocuments", label: "Enrollment Documents", setter: "setEnrollmentDocuments", filesSetter: "setEnrollmentFiles" },
  { field: "iefDocuments", label: "IEF", setter: "setIefDocuments", filesSetter: "setIefFiles" },
  { field: "immunizationDocuments", label: "Immunizations", setter: "setImmunizationDocuments", filesSetter: "setImmunizationFiles" },
  { field: "infantDocuments", label: "Infant Documents", setter: "setInfantDocuments", filesSetter: "setInfantFiles" },
  { field: "otherDocuments", label: "Other", setter: "setOtherDocuments", filesSetter: "setOtherFiles" },
];

function getDocumentTypeMeta(field) {
  return CHILD_DOCUMENT_TYPES.find((item) => item.field === field) || null;
}

function createManualDocumentEntry(field, expirationDate) {
  const meta = getDocumentTypeMeta(field);
  return {
    url: null,
    originalName: meta?.label ? `${meta.label} expiration` : "Expiration record",
    mimeType: null,
    size: null,
    uploadedAt: null,
    expirationDate: expirationDate || null,
    documentType: meta?.label || field,
    isManualEntry: true,
  };
}

function createDocumentExpirations(overrides = {}) {
  return {
    healthAssessmentDocuments: "",
    enrollmentDocuments: "",
    iefDocuments: "",
    immunizationDocuments: "",
    infantDocuments: "",
    otherDocuments: "",
    ...overrides,
  };
}

function createDocumentExpirationTouched(overrides = {}) {
  return {
    healthAssessmentDocuments: false,
    enrollmentDocuments: false,
    iefDocuments: false,
    immunizationDocuments: false,
    infantDocuments: false,
    otherDocuments: false,
    ...overrides,
  };
}

function toDocumentDateInput(value) {
  if (!value) return "";
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDocumentExpirationInputValue(docs) {
  const firstWithExpiration = (Array.isArray(docs) ? docs : []).find((doc) => doc?.expirationDate);
  return toDocumentDateInput(firstWithExpiration?.expirationDate);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatFlagDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

const FLAG_STYLE_BY_TYPE = {
  ALLERGY: { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
  INCIDENT: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  BEHAVIOR_LEVEL_HIGH: { bg: "#FCE7F3", text: "#9D174D", border: "#FBCFE8" },
  BEHAVIOR_REPEAT: { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  BEHIND_STEPS: { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
  OUTDATED_DOCUMENT: { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  MISSING_DOB: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  MISSING_CLASSROOM: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
};

function extractAssessmentRows(activities) {
  return (Array.isArray(activities) ? activities : [])
    .filter((activity) => {
      const details = activity?.details;
      return details && typeof details === "object" && details.kind === "DAILY_GRADE";
    })
    .map((activity) => {
      const details = activity.details || {};
      const grade = Number(details.grade);
      return {
        id: activity.id,
        createdAt: activity.createdAt,
        grade: Number.isFinite(grade) ? grade : null,
        domains: details.domains && typeof details.domains === "object" ? details.domains : null,
        notes: activity.notes || "",
      };
    });
}

export default function AdminChildren() {
  const toast = useToast();
  const router = useRouter();
  const [children, setChildren] = useState([]);
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("");
  const [profileFlagFilter, setProfileFlagFilter] = useState("");
  const [flagStatusFilter, setFlagStatusFilter] = useState("open");
  const [flagChildFilter, setFlagChildFilter] = useState("");
  const [flagClassroomFilter, setFlagClassroomFilter] = useState("");
  const [flagCategoryFilter, setFlagCategoryFilter] = useState("");
  const [flagDateFrom, setFlagDateFrom] = useState("");
  const [flagDateTo, setFlagDateTo] = useState("");
  const [flagItems, setFlagItems] = useState([]);
  const [flagSummary, setFlagSummary] = useState({ openCount: 0, closedCount: 0 });
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [selectedFlagKey, setSelectedFlagKey] = useState("");
  const [flagSavingKey, setFlagSavingKey] = useState("");
  const [copyContactsFromChildId, setCopyContactsFromChildId] = useState("");

  const [editing, setEditing] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [centerId, setCenterId] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [parentAccountIds, setParentAccountIds] = useState(createParentAccountIds());
  const [parentContacts, setParentContacts] = useState(createParentContacts());

  const [emergencyContacts, setEmergencyContacts] = useState(createEmergencyContacts());
  const [allergies, setAllergies] = useState("");
  const [carpool, setCarpool] = useState("");
  const [enrollmentStartDate, setEnrollmentStartDate] = useState("");
  const [enrollmentEndDate, setEnrollmentEndDate] = useState("");

  const [feedingFoods, setFeedingFoods] = useState("");
  const [feedingFormula, setFeedingFormula] = useState("");
  const [feedingBottlesPerDay, setFeedingBottlesPerDay] = useState("");
  const [feedingBottleNotes, setFeedingBottleNotes] = useState("");

  const [healthAssessmentDocuments, setHealthAssessmentDocuments] = useState([]);
  const [enrollmentDocuments, setEnrollmentDocuments] = useState([]);
  const [iefDocuments, setIefDocuments] = useState([]);
  const [immunizationDocuments, setImmunizationDocuments] = useState([]);
  const [infantDocuments, setInfantDocuments] = useState([]);
  const [otherDocuments, setOtherDocuments] = useState([]);
  const [healthAssessmentFiles, setHealthAssessmentFiles] = useState([]);
  const [enrollmentFiles, setEnrollmentFiles] = useState([]);
  const [iefFiles, setIefFiles] = useState([]);
  const [immunizationFiles, setImmunizationFiles] = useState([]);
  const [infantFiles, setInfantFiles] = useState([]);
  const [otherFiles, setOtherFiles] = useState([]);
  const [documentExpirations, setDocumentExpirations] = useState(createDocumentExpirations());
  const [documentExpirationTouched, setDocumentExpirationTouched] = useState(
    createDocumentExpirationTouched(),
  );
  const [docReportType, setDocReportType] = useState("");
  const [docReportExpirationFrom, setDocReportExpirationFrom] = useState("");
  const [docReportExpirationTo, setDocReportExpirationTo] = useState("");
  const [docReportFamily, setDocReportFamily] = useState("");

  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState("");
  const [stepsPlans, setStepsPlans] = useState([]);
  const [stepsCompletions, setStepsCompletions] = useState([]);
  const [stepsDomain, setStepsDomain] = useState("");

  const [childPermissions, setChildPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [profileChild, setProfileChild] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTransferClassRoomId, setProfileTransferClassRoomId] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [rowAttendanceSavingId, setRowAttendanceSavingId] = useState("");
  const [rowTransferSavingId, setRowTransferSavingId] = useState("");
  const [quickTransferClassRoomIds, setQuickTransferClassRoomIds] = useState({});

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [kids, c, cls, u] = await Promise.all([
        apiJson("/api/v1/children"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/classes"),
        apiJson("/api/v1/users"),
      ]);
      const nextChildren = Array.isArray(kids) ? kids : [];
      setChildren(nextChildren);
      setCenters(Array.isArray(c) ? c : []);
      setClasses(Array.isArray(cls) ? cls : []);
      setUsers(Array.isArray(u) ? u : []);
      setQuickTransferClassRoomIds((current) => {
        const allowedIds = new Set(nextChildren.map((child) => child.id));
        return Object.fromEntries(
          Object.entries(current).filter(([childId]) => allowedIds.has(childId)),
        );
      });
    } catch (e) {
      setError(e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const nextProfileFlagFilter =
      router.query.profileFlag === "missing-profile" ? "missing-profile" : "";
    setProfileFlagFilter(nextProfileFlagFilter);
  }, [router.isReady, router.query.profileFlag]);

  const dashboardCenterId = useMemo(() => {
    if (!router.isReady) return "";
    return typeof router.query.centerId === "string" ? router.query.centerId : "";
  }, [router.isReady, router.query.centerId]);

  const flagsView = useMemo(() => {
    if (!router.isReady) return false;
    return router.query.view === "flags";
  }, [router.isReady, router.query.view]);

  const parents = useMemo(() => {
    return users.filter((u) => userRoles(u).includes("PARENT")).sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users]);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const classroomOptions = useMemo(() => {
    return [...classes].sort((left, right) => {
      const leftCenter = centerById[left.centerId]?.name || "";
      const rightCenter = centerById[right.centerId]?.name || "";
      const centerCompare = leftCenter.localeCompare(rightCenter);
      if (centerCompare !== 0) return centerCompare;
      return (left.name || "").localeCompare(right.name || "");
    });
  }, [classes, centerById]);

  const refreshFlags = useCallback(
    async (preferredFlagKey = "") => {
      if (!flagsView) return;

      setFlagsLoading(true);
      try {
        const params = new URLSearchParams();
        if (dashboardCenterId) params.set("centerId", dashboardCenterId);
        if (flagStatusFilter) params.set("status", flagStatusFilter);
        if (flagChildFilter) params.set("childId", flagChildFilter);
        if (flagClassroomFilter) params.set("classRoomId", flagClassroomFilter);
        if (flagCategoryFilter) params.set("category", flagCategoryFilter);
        if (flagDateFrom) params.set("from", flagDateFrom);
        if (flagDateTo) params.set("to", flagDateTo);

        const data = await apiJson(`/api/v1/child-flags?${params.toString()}`);
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        const routeFlagKey =
          router.isReady && typeof router.query.flagKey === "string"
            ? router.query.flagKey
            : "";

        setFlagItems(nextItems);
        setFlagSummary({
          openCount: Number(data?.summary?.openCount || 0),
          closedCount: Number(data?.summary?.closedCount || 0),
        });
        setSelectedFlagKey((current) => {
          const candidate =
            preferredFlagKey ||
            current ||
            routeFlagKey;
          if (candidate && nextItems.some((item) => item.flagKey === candidate)) {
            return candidate;
          }
          return nextItems[0]?.flagKey || "";
        });
      } catch (e) {
        setError(e.message || "Failed to load child flags");
        setFlagItems([]);
        setFlagSummary({ openCount: 0, closedCount: 0 });
        setSelectedFlagKey("");
      } finally {
        setFlagsLoading(false);
      }
    },
    [
      dashboardCenterId,
      flagChildFilter,
      flagClassroomFilter,
      flagCategoryFilter,
      flagDateFrom,
      flagDateTo,
      flagStatusFilter,
      flagsView,
      router.isReady,
      router.query.flagKey,
    ],
  );

  const profileFlagIssuesByChildId = useMemo(() => {
    const issuesByChildId = {};
    for (const child of children) {
      const issues = [];
      if (!child.birthDate) issues.push("Missing DOB");
      if (!child.classRoomId) issues.push("Missing classroom");
      if (issues.length) {
        issuesByChildId[child.id] = issues;
      }
    }
    return issuesByChildId;
  }, [children]);

  const scopedChildren = useMemo(() => {
    return dashboardCenterId
      ? children.filter((child) => child.centerId === dashboardCenterId)
      : children;
  }, [children, dashboardCenterId]);

  const scopedFlaggedChildren = useMemo(() => {
    return scopedChildren
      .filter((child) => profileFlagIssuesByChildId[child.id])
      .map((child) => ({
        child,
        issues: profileFlagIssuesByChildId[child.id],
      }));
  }, [profileFlagIssuesByChildId, scopedChildren]);

  const filteredSorted = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    return [...scopedChildren]
      .filter((ch) => {
        if (!query) return true;
        const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim().toLowerCase();
        return name.includes(query) || String(ch.id || "").toLowerCase().includes(query);
      })
      .filter((ch) => {
        if (!classroomFilter) return true;
        const currentClassRoomId = getEffectiveClassRoomId(ch);
        if (classroomFilter === "__unassigned__") return !currentClassRoomId;
        return currentClassRoomId === classroomFilter;
      })
      .filter((ch) => {
        if (profileFlagFilter !== "missing-profile") return true;
        return !!profileFlagIssuesByChildId[ch.id];
      })
      .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [classroomFilter, profileFlagFilter, profileFlagIssuesByChildId, q, scopedChildren]);

  useEffect(() => {
    if (!flagsView) return;
    refreshFlags();
  }, [flagsView, refreshFlags]);

  useEffect(() => {
    if (!router.isReady) return;
    const childId =
      typeof router.query.childId === "string" ? router.query.childId : "";
    if (!childId || !children.some((child) => child.id === childId)) return;
    if (profileChild?.id === childId || profileLoading) return;
    openProfile(childId);
  }, [
    children,
    profileChild?.id,
    profileLoading,
    router.isReady,
    router.query.childId,
  ]);

  const contactTemplateChildren = useMemo(() => {
    return [...children]
      .filter((child) => !centerId || child.centerId === centerId)
      .sort((left, right) =>
        childFullName(left).localeCompare(childFullName(right)),
      );
  }, [centerId, children]);

  const documentReportRows = useMemo(() => {
    const rows = [];
    for (const child of children) {
      const linkedParent = getLinkedParentUsers(child)[0];
      const family = linkedParent?.name || linkedParent?.email || "";
      for (const type of CHILD_DOCUMENT_TYPES) {
        const docs = Array.isArray(child[type.field]) ? child[type.field] : [];
        for (const doc of docs) {
          const expiration = doc.expirationDate || "";
          if (docReportType && type.field !== docReportType) continue;
          if (docReportFamily) {
            const haystack = `${family} ${childFullName(child)}`.toLowerCase();
            if (!haystack.includes(docReportFamily.toLowerCase())) continue;
          }
          if (docReportExpirationFrom && (!expiration || new Date(expiration) < new Date(docReportExpirationFrom))) continue;
          if (docReportExpirationTo && (!expiration || new Date(expiration) > new Date(docReportExpirationTo))) continue;
          rows.push({
            child: childFullName(child),
            family,
            type: type.label,
            name: doc.originalName || doc.url,
            expiration,
          });
        }
      }
    }
    return rows.sort((a, b) => String(a.expiration || "9999").localeCompare(String(b.expiration || "9999")));
  }, [children, docReportExpirationFrom, docReportExpirationTo, docReportFamily, docReportType]);

  function printDocumentReport() {
    const html = `
      <html><head><title>Child Documents Report</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#f3f4f6}</style>
      </head><body>
      <h1>Child Documents Report</h1>
      <table><thead><tr><th>Child</th><th>Family</th><th>Document</th><th>File</th><th>Expiration</th></tr></thead>
      <tbody>${documentReportRows.map((row) => `<tr><td>${escapeHtml(row.child)}</td><td>${escapeHtml(row.family)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.expiration || "")}</td></tr>`).join("")}</tbody></table>
      </body></html>
    `;
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const completedAtByItemId = useMemo(() => {
    return Object.fromEntries(
      (stepsCompletions || []).map((c) => [c.itemId, c.completedAt]),
    );
  }, [stepsCompletions]);

  const allStepRows = useMemo(() => {
    const now = new Date();
    const rows = [];
    for (const plan of Array.isArray(stepsPlans) ? stepsPlans : []) {
      const start = plan?.periodStart ? new Date(plan.periodStart) : null;
      if (!start || Number.isNaN(start.getTime())) continue;
      const end = planEndDate(plan);
      for (const item of Array.isArray(plan.items) ? plan.items : []) {
        const completedAt = completedAtByItemId[item.id] || null;
        const domain = item?.lesson?.category?.name || "Other";
        rows.push({
          plan,
          item,
          domain,
          completedAt,
          isCompleted: !!completedAt,
          start,
          end,
          isUpcoming: start > now,
          isCurrent: end ? start <= now && now < end : start <= now,
          isOverdue: end ? now >= end && !completedAt : false,
        });
      }
    }

    return rows.sort((a, b) => {
      const ad = new Date(a.plan.periodStart).getTime();
      const bd = new Date(b.plan.periodStart).getTime();
      if (ad !== bd) return ad - bd;
      return Number(a.item.sortOrder || 0) - Number(b.item.sortOrder || 0);
    });
  }, [stepsPlans, completedAtByItemId]);

  const stepDomains = useMemo(() => {
    return [...new Set(allStepRows.map((r) => r.domain))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [allStepRows]);

  const stepRows = useMemo(() => {
    return stepsDomain ? allStepRows.filter((r) => r.domain === stepsDomain) : allStepRows;
  }, [allStepRows, stepsDomain]);

  const catchupRows = useMemo(() => {
    return stepRows.filter((r) => r.isOverdue);
  }, [stepRows]);

  const currentRows = useMemo(() => {
    return stepRows.filter((r) => r.isCurrent && !r.isCompleted);
  }, [stepRows]);

  const upcomingRows = useMemo(() => {
    return stepRows.filter((r) => r.isUpcoming && !r.isCompleted);
  }, [stepRows]);

  const resetForm = useCallback(() => {
    setEditing(null);
    setCopyContactsFromChildId("");
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setCenterId("");
    setClassRoomId("");
    setParentAccountIds(createParentAccountIds());
    setParentContacts(createParentContacts());
    setEmergencyContacts(createEmergencyContacts());
    setAllergies("");
    setCarpool("");
    setEnrollmentStartDate("");
    setEnrollmentEndDate("");

    setFeedingFoods("");
    setFeedingFormula("");
    setFeedingBottlesPerDay("");
    setFeedingBottleNotes("");

    setHealthAssessmentDocuments([]);
    setEnrollmentDocuments([]);
    setIefDocuments([]);
    setImmunizationDocuments([]);
    setInfantDocuments([]);
    setOtherDocuments([]);
    setHealthAssessmentFiles([]);
    setEnrollmentFiles([]);
    setIefFiles([]);
    setImmunizationFiles([]);
    setInfantFiles([]);
    setOtherFiles([]);
    setDocumentExpirations(createDocumentExpirations());
    setDocumentExpirationTouched(createDocumentExpirationTouched());
  }, []);

  const startEdit = useCallback((child) => {
    setEditing(child);
    setCopyContactsFromChildId("");
    setFirstName(child.firstName || "");
    setLastName(child.lastName || "");
    setBirthDate(child.birthDate ? child.birthDate.slice(0, 10) : "");
    setCenterId(child.centerId || "");
    setClassRoomId(child.classRoomId || "");
    setParentAccountIds(createParentAccountIds(getLinkedParentIds(child)));
    setParentContacts(createParentContacts(getParentContacts(child)));
    setEmergencyContacts(createEmergencyContacts(getEmergencyContacts(child)));
    setAllergies(child.allergies || "");
    setCarpool(child.carpool || "");
    setEnrollmentStartDate(child.enrollmentStartDate ? child.enrollmentStartDate.slice(0, 10) : "");
    setEnrollmentEndDate(child.enrollmentEndDate ? child.enrollmentEndDate.slice(0, 10) : "");

    const feeding = child.feedingPlan && typeof child.feedingPlan === "object" ? child.feedingPlan : null;
    setFeedingFoods(feeding?.foods || "");
    setFeedingFormula(feeding?.formula || "");
    setFeedingBottlesPerDay(
      feeding?.bottlesPerDay === null || feeding?.bottlesPerDay === undefined
        ? ""
        : String(feeding.bottlesPerDay),
    );
    setFeedingBottleNotes(feeding?.bottleNotes || "");

    const nextHealthAssessmentDocuments = Array.isArray(child.healthAssessmentDocuments)
      ? child.healthAssessmentDocuments
      : [];
    const nextEnrollmentDocuments = Array.isArray(child.enrollmentDocuments)
      ? child.enrollmentDocuments
      : [];
    const nextIefDocuments = Array.isArray(child.iefDocuments)
      ? child.iefDocuments
      : [];
    const nextImmunizationDocuments = Array.isArray(child.immunizationDocuments)
      ? child.immunizationDocuments
      : [];
    const nextInfantDocuments = Array.isArray(child.infantDocuments)
      ? child.infantDocuments
      : [];
    const nextOtherDocuments = Array.isArray(child.otherDocuments)
      ? child.otherDocuments
      : [];

    setHealthAssessmentDocuments(nextHealthAssessmentDocuments);
    setEnrollmentDocuments(nextEnrollmentDocuments);
    setIefDocuments(nextIefDocuments);
    setImmunizationDocuments(nextImmunizationDocuments);
    setInfantDocuments(nextInfantDocuments);
    setOtherDocuments(nextOtherDocuments);
    setHealthAssessmentFiles([]);
    setEnrollmentFiles([]);
    setIefFiles([]);
    setImmunizationFiles([]);
    setInfantFiles([]);
    setOtherFiles([]);
    setDocumentExpirations(
      createDocumentExpirations({
        healthAssessmentDocuments: getDocumentExpirationInputValue(
          nextHealthAssessmentDocuments,
        ),
        enrollmentDocuments: getDocumentExpirationInputValue(
          nextEnrollmentDocuments,
        ),
        iefDocuments: getDocumentExpirationInputValue(nextIefDocuments),
        immunizationDocuments: getDocumentExpirationInputValue(
          nextImmunizationDocuments,
        ),
        infantDocuments: getDocumentExpirationInputValue(nextInfantDocuments),
        otherDocuments: getDocumentExpirationInputValue(nextOtherDocuments),
      }),
    );
    setDocumentExpirationTouched(createDocumentExpirationTouched());
  }, []);

  const openCreate = useCallback(() => {
    setError("");
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (child) => {
      setError("");
      startEdit(child);
      setModalOpen(true);
    },
    [startEdit],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setError("");
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!modalOpen) return;

    const prevOverflow = document?.body?.style?.overflow || "";
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen, closeModal]);

  const isInfant = useMemo(() => {
    const months = ageInMonths(birthDate);
    return months !== null ? months < 12 : false;
  }, [birthDate]);

  function parseOptionalWholeNumber(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      throw new Error("Must be a whole number.");
    }
    if (num < 0) throw new Error("Must be >= 0.");
    return num;
  }

  function updateParentContact(index, field, value) {
    setParentContacts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function updateParentAccount(index, value) {
    setParentAccountIds((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex === index) return value;
        if (value && item === value) return "";
        return item;
      }),
    );
  }

  function updateEmergencyContact(index, field, value) {
    setEmergencyContacts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
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

  function withDocumentMeta(docs, field) {
    const type = getDocumentTypeMeta(field);
    const expirationDate = documentExpirations[field] || null;
    return (Array.isArray(docs) ? docs : []).map((doc) => ({
      ...doc,
      documentType: doc?.documentType || type?.label || field,
      expirationDate,
      isManualEntry: Boolean(doc?.isManualEntry) && !doc?.url,
    }));
  }

  function buildDocumentPayload(existingDocs, uploadedDocs, field) {
    const existingList = Array.isArray(existingDocs) ? existingDocs : [];
    const realExistingDocs = existingList.filter((doc) => doc?.url);
    const manualExistingDocs = existingList.filter(
      (doc) => !doc?.url && (doc?.expirationDate || doc?.originalName || doc?.documentType),
    );
    const uploadedWithMeta = withDocumentMeta(uploadedDocs, field);

    const persistedDocs = documentExpirationTouched[field]
      ? withDocumentMeta(realExistingDocs, field)
      : realExistingDocs.map((doc) => {
          const type = getDocumentTypeMeta(field);
          return {
            ...doc,
            documentType: doc?.documentType || type?.label || field,
            expirationDate: doc?.expirationDate || null,
            isManualEntry: false,
          };
        });

    if (!persistedDocs.length && !uploadedWithMeta.length) {
      if (documentExpirationTouched[field]) {
        return documentExpirations[field]
          ? [createManualDocumentEntry(field, documentExpirations[field])]
          : [];
      }
      if (manualExistingDocs.length) {
        return manualExistingDocs.map((doc) => ({
          ...doc,
          isManualEntry: true,
        }));
      }
    }

    return [...persistedDocs, ...uploadedWithMeta];
  }

  function updateDocumentExpiration(field, value) {
    setDocumentExpirations((cur) => ({ ...cur, [field]: value }));
    setDocumentExpirationTouched((cur) => ({ ...cur, [field]: true }));
  }

  function applyContactTemplate(childId) {
    const sourceChild = children.find((child) => child.id === childId);
    if (!sourceChild) return;
    setParentAccountIds(createParentAccountIds(getLinkedParentIds(sourceChild)));
    setParentContacts(createParentContacts(getParentContacts(sourceChild)));
    setEmergencyContacts(createEmergencyContacts(getEmergencyContacts(sourceChild)));
  }

  function planEndDate(plan) {
    const start = plan?.periodStart ? new Date(plan.periodStart) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    if (plan.period === "DAY") end.setDate(end.getDate() + 1);
    else if (plan.period === "WEEK") end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    return end;
  }

  useEffect(() => {
    if (!modalOpen || !editing?.id) {
      setChildPermissions([]);
      return;
    }
    (async () => {
      setPermissionsLoading(true);
      try {
        const perms = await apiJson(`/api/v1/children/${editing.id}/permissions`);
        setChildPermissions(Array.isArray(perms) ? perms : []);
      } catch {
        setChildPermissions([]);
      } finally {
        setPermissionsLoading(false);
      }
    })();
  }, [modalOpen, editing?.id]);

  useEffect(() => {
    if (!modalOpen || !editing?.id || !editing?.centerId) {
      setStepsPlans([]);
      setStepsCompletions([]);
      setStepsDomain("");
      setStepsError("");
      return;
    }

    (async () => {
      setStepsLoading(true);
      setStepsError("");
      try {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - 60);

        const to = new Date();
        to.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 60);

        const plansQs = new URLSearchParams({
          centerId: editing.centerId,
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const completionsQs = new URLSearchParams({
          childId: editing.id,
          from: from.toISOString(),
          to: to.toISOString(),
        });

        const [plans, completions] = await Promise.all([
          apiJson(`/api/v1/milestone-checklists?${plansQs.toString()}`),
          apiJson(
            `/api/v1/milestone-checklists/completions?${completionsQs.toString()}`,
          ),
        ]);

        setStepsPlans(Array.isArray(plans) ? plans : []);
        setStepsCompletions(Array.isArray(completions) ? completions : []);
      } catch (e) {
        setStepsError(e.message || "Failed to load steps of progression");
        setStepsPlans([]);
        setStepsCompletions([]);
      } finally {
        setStepsLoading(false);
      }
    })();
  }, [modalOpen, editing?.id, editing?.centerId]);

  async function createChild(e) {
    e.preventDefault();
    setError("");
    try {
      const bottlesPerDay = parseOptionalWholeNumber(feedingBottlesPerDay);
      const newHealthDocs = await uploadFiles(healthAssessmentFiles);
      const newEnrollDocs = await uploadFiles(enrollmentFiles);
      const newIefDocs = await uploadFiles(iefFiles);
      const newImmunizationDocs = await uploadFiles(immunizationFiles);
      const newInfantDocs = await uploadFiles(infantFiles);
      const newOtherDocs = await uploadFiles(otherFiles);
      await apiJson("/api/v1/children", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName: lastName || null,
          birthDate: birthDate || null,
          centerId,
          classRoomId: classRoomId || null,
          parentAccountIds: parentAccountIds.filter(Boolean),
          parentContacts,
          emergencyContacts,
          allergies: allergies || null,
          carpool: carpool || null,
          enrollmentStartDate: enrollmentStartDate || null,
          enrollmentEndDate: enrollmentEndDate || null,
          healthAssessmentDocuments: buildDocumentPayload(
            healthAssessmentDocuments,
            newHealthDocs,
            "healthAssessmentDocuments",
          ),
          enrollmentDocuments: buildDocumentPayload(
            enrollmentDocuments,
            newEnrollDocs,
            "enrollmentDocuments",
          ),
          iefDocuments: buildDocumentPayload(
            iefDocuments,
            newIefDocs,
            "iefDocuments",
          ),
          immunizationDocuments: buildDocumentPayload(
            immunizationDocuments,
            newImmunizationDocs,
            "immunizationDocuments",
          ),
          infantDocuments: buildDocumentPayload(
            infantDocuments,
            newInfantDocs,
            "infantDocuments",
          ),
          otherDocuments: buildDocumentPayload(
            otherDocuments,
            newOtherDocs,
            "otherDocuments",
          ),
          feedingPlan: isInfant
            ? {
                foods: feedingFoods || null,
                formula: feedingFormula || null,
                bottlesPerDay,
                bottleNotes: feedingBottleNotes || null,
              }
            : null,
        }),
      });
      resetForm();
      setModalOpen(false);
      await refresh();
      toast.success(`Child ${firstName} ${lastName || ""} added successfully.`);
    } catch (e2) {
      setError(e2.message || "Failed to create child");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const bottlesPerDay = parseOptionalWholeNumber(feedingBottlesPerDay);
      const newHealthDocs = await uploadFiles(healthAssessmentFiles);
      const newEnrollDocs = await uploadFiles(enrollmentFiles);
      const newIefDocs = await uploadFiles(iefFiles);
      const newImmunizationDocs = await uploadFiles(immunizationFiles);
      const newInfantDocs = await uploadFiles(infantFiles);
      const newOtherDocs = await uploadFiles(otherFiles);
      await apiJson(`/api/v1/children/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName,
          lastName: lastName || null,
          birthDate: birthDate || null,
          classRoomId: classRoomId || null,
          parentAccountIds: parentAccountIds.filter(Boolean),
          parentContacts,
          emergencyContacts,
          allergies: allergies || null,
          carpool: carpool || null,
          enrollmentStartDate: enrollmentStartDate || null,
          enrollmentEndDate: enrollmentEndDate || null,
          healthAssessmentDocuments: buildDocumentPayload(
            healthAssessmentDocuments,
            newHealthDocs,
            "healthAssessmentDocuments",
          ),
          enrollmentDocuments: buildDocumentPayload(
            enrollmentDocuments,
            newEnrollDocs,
            "enrollmentDocuments",
          ),
          iefDocuments: buildDocumentPayload(
            iefDocuments,
            newIefDocs,
            "iefDocuments",
          ),
          immunizationDocuments: buildDocumentPayload(
            immunizationDocuments,
            newImmunizationDocs,
            "immunizationDocuments",
          ),
          infantDocuments: buildDocumentPayload(
            infantDocuments,
            newInfantDocs,
            "infantDocuments",
          ),
          otherDocuments: buildDocumentPayload(
            otherDocuments,
            newOtherDocs,
            "otherDocuments",
          ),
          feedingPlan: isInfant
            ? {
                foods: feedingFoods || null,
                formula: feedingFormula || null,
                bottlesPerDay,
                bottleNotes: feedingBottleNotes || null,
              }
            : null,
        }),
      });
      resetForm();
      setModalOpen(false);
      await refresh();
      toast.success(`${firstName} ${lastName || ""} updated successfully.`);
    } catch (e2) {
      setError(e2.message || "Failed to update child");
    }
  }

  async function deleteChild(id) {
    setDeleteConfirmId(null);
    setError("");
    try {
      await apiJson(`/api/v1/children/${id}`, { method: "DELETE" });
      await refresh();
      toast.success("Child record deleted.");
    } catch (e2) {
      setError(e2.message || "Failed to delete child");
    }
  }

  async function openProfile(childId) {
    setProfileLoading(true);
    setProfileChild(null);
    setProfileTransferClassRoomId("");
    try {
      const data = await apiJson(`/api/v1/children/${childId}`);
      setProfileChild(data || null);
      setProfileTransferClassRoomId(getEffectiveClassRoomId(data || null));
    } catch (e) {
      setError(e.message || "Failed to load child profile");
    } finally {
      setProfileLoading(false);
    }
  }

  function closeProfile() {
    setProfileChild(null);
    setProfileLoading(false);
    setProfileTransferClassRoomId("");
    setTransferSaving(false);
    setAttendanceSaving(false);
  }

  async function reloadProfileChild(childId) {
    if (!childId) return null;
    const updated = await apiJson(`/api/v1/children/${childId}`);
    setProfileChild(updated || null);
    setProfileTransferClassRoomId(getEffectiveClassRoomId(updated || null));
    return updated;
  }

  function quickTransferValue(child) {
    if (Object.prototype.hasOwnProperty.call(quickTransferClassRoomIds, child.id)) {
      return quickTransferClassRoomIds[child.id];
    }
    return getEffectiveClassRoomId(child) || "";
  }

  function updateQuickTransferValue(childId, value) {
    setQuickTransferClassRoomIds((current) => ({
      ...current,
      [childId]: value,
    }));
  }

  async function updateChildAttendanceFromCard(child, action) {
    if (!child?.id) return;
    setRowAttendanceSavingId(child.id);
    setError("");
    try {
      const endpoint =
        action === "CHECK_IN"
          ? "/api/v1/attendance/check-in"
          : "/api/v1/attendance/check-out";
      await apiJson(endpoint, {
        method: "POST",
        body: JSON.stringify({ childId: child.id }),
      });
      await refresh();
      if (profileChild?.id === child.id) {
        await reloadProfileChild(child.id);
      }
      toast.success(
        action === "CHECK_IN"
          ? "Child checked in successfully."
          : "Child checked out successfully.",
      );
    } catch (e) {
      setError(
        e.message ||
          (action === "CHECK_IN"
            ? "Failed to check child in"
            : "Failed to check child out"),
      );
    } finally {
      setRowAttendanceSavingId("");
    }
  }

  async function saveChildTransferFromCard(child, targetClassRoomId = quickTransferValue(child)) {
    if (!child?.id) return;
    setRowTransferSavingId(child.id);
    setError("");
    try {
      await apiJson("/api/v1/attendance/transfer-classroom", {
        method: "POST",
        body: JSON.stringify({
          childId: child.id,
          targetClassRoomId: targetClassRoomId || null,
        }),
      });
      await refresh();
      if (profileChild?.id === child.id) {
        await reloadProfileChild(child.id);
      }
      setQuickTransferClassRoomIds((current) => {
        const next = { ...current };
        delete next[child.id];
        return next;
      });
      toast.success("Temporary classroom updated for today.");
    } catch (e) {
      setError(e.message || "Failed to update today's classroom");
    } finally {
      setRowTransferSavingId("");
    }
  }

  async function saveProfileTransfer(targetClassRoomId = profileTransferClassRoomId) {
    if (!profileChild) return;
    setTransferSaving(true);
    setError("");
    try {
      await apiJson("/api/v1/attendance/transfer-classroom", {
        method: "POST",
        body: JSON.stringify({
          childId: profileChild.id,
          targetClassRoomId: targetClassRoomId || null,
        }),
      });
      await refresh();
      await reloadProfileChild(profileChild.id);
      toast.success("Temporary classroom updated for today.");
    } catch (e) {
      setError(e.message || "Failed to update today's classroom");
    } finally {
      setTransferSaving(false);
    }
  }

  async function updateProfileAttendance(action) {
    if (!profileChild) return;
    setAttendanceSaving(true);
    setError("");
    try {
      const endpoint =
        action === "CHECK_IN"
          ? "/api/v1/attendance/check-in"
          : "/api/v1/attendance/check-out";
      await apiJson(endpoint, {
        method: "POST",
        body: JSON.stringify({ childId: profileChild.id }),
      });
      await refresh();
      await reloadProfileChild(profileChild.id);
      toast.success(
        action === "CHECK_IN"
          ? "Child checked in successfully."
          : "Child checked out successfully.",
      );
    } catch (e) {
      setError(
        e.message ||
          (action === "CHECK_IN"
            ? "Failed to check child in"
            : "Failed to check child out"),
      );
    } finally {
      setAttendanceSaving(false);
    }
  }

  async function setChecklistItemCompleted(itemId, completed) {
    if (!editing?.id) return;
    setStepsError("");
    try {
      const record = await apiJson("/api/v1/milestone-checklists/completions", {
        method: "POST",
        body: JSON.stringify({
          childId: editing.id,
          itemId,
          completed,
        }),
      });

      setStepsCompletions((cur) => {
        const arr = Array.isArray(cur) ? cur : [];
        const idx = arr.findIndex((c) => c.itemId === record.itemId);
        const next = { ...(idx >= 0 ? arr[idx] : {}), ...record };
        if (idx >= 0) return arr.map((c, i) => (i === idx ? next : c));
        return [...arr, next];
      });
    } catch (e) {
      setStepsError(e.message || "Failed to update completion");
    }
  }

  async function updateFlagReview(item, action) {
    if (!item?.flagKey) return;
    setFlagSavingKey(item.flagKey);
    setError("");
    try {
      await apiJson("/api/v1/child-flags", {
        method: "POST",
        body: JSON.stringify({
          action,
          flagKey: item.flagKey,
          centerId: item.center?.id || dashboardCenterId || "",
          childId: item.child?.id || "",
        }),
      });
      await refreshFlags(action === "open" ? item.flagKey : "");
      toast.success(action === "close" ? "Flag moved to closed." : "Flag reopened.");
    } catch (e) {
      setError(e.message || "Failed to update child flag");
    } finally {
      setFlagSavingKey("");
    }
  }

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = children.length;
    const infants = children.filter((c) => { const ag = childAgeGroup(c); return ag === "0-1"; }).length;
    const withAllergies = children.filter((c) => c.allergies).length;
    const unassigned = children.filter((c) => !c.classRoomId).length;
    return { total, infants, withAllergies, unassigned };
  }, [children]);

  const selectedFlagItem = useMemo(() => {
    return flagItems.find((item) => item.flagKey === selectedFlagKey) || null;
  }, [flagItems, selectedFlagKey]);

  function getInitials(ch) {
    const f = (ch.firstName || "")[0] || "";
    const l = (ch.lastName || "")[0] || "";
    return (f + l).toUpperCase() || "?";
  }

  const AGE_COLORS = {
    "0-1": { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
    "2": { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
    "3": { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
    "4-5": { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
    "6-7": { bg: "#FCE7F3", text: "#9D174D", border: "#FBCFE8" },
    "8-12": { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
    "12+": { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" },
    "Unknown": { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
  };

  return (
    <AdminLayout title="Children">
      {/* Stats Row */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard icon="👶" label="Total Children" value={stats.total} color="#2563eb" bg="#DBEAFE" />
          <StatCard icon="🍼" label="Infants (0-1)" value={stats.infants} color="#D97706" bg="#FEF3C7" />
          <StatCard icon="⚠️" label="With Allergies" value={stats.withAllergies} color="#DC2626" bg="#FEE2E2" />
          <StatCard icon="📋" label="No Classroom" value={stats.unassigned} color="#7C3AED" bg="#EDE9FE" />
        </div>
      )}

      <div style={panelStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>
              {flagsView ? "Children Flags" : "Children"}
            </h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13 }}>
              {flagsView
                ? "Review open and closed child flags without scanning the full child list."
                : "Manage child records, assignments, and enrollment details."}
            </p>
          </div>
          {!flagsView ? (
            <button type="button" style={primaryButtonStyle} onClick={openCreate}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Child
            </button>
          ) : null}
        </div>

        {flagsView ? (
          <>
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 220px" }}>
                <div style={filterLabelStyle}>Status</div>
                <select value={flagStatusFilter} onChange={(e) => setFlagStatusFilter(e.target.value)} style={inputStyle}>
                  <option value="open">Open flags</option>
                  <option value="closed">Closed flags</option>
                  <option value="all">Open and closed</option>
                </select>
              </div>
              <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                <div style={filterLabelStyle}>Child</div>
                <select value={flagChildFilter} onChange={(e) => setFlagChildFilter(e.target.value)} style={inputStyle}>
                  <option value="">All children</option>
                  {[...scopedChildren]
                    .sort((left, right) => childFullName(left).localeCompare(childFullName(right)))
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        {childFullName(child)}
                      </option>
                    ))}
                </select>
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                <div style={filterLabelStyle}>Classroom</div>
                <select value={flagClassroomFilter} onChange={(e) => setFlagClassroomFilter(e.target.value)} style={inputStyle}>
                  <option value="">All classrooms</option>
                  {classroomOptions.map((classroom) => {
                    const centerName = centerById[classroom.centerId]?.name || "";
                    return (
                      <option key={classroom.id} value={classroom.id}>
                        {centerName ? `${classroom.name} - ${centerName}` : classroom.name}
                      </option>
                    );
                  })}
                  <option value="__unassigned__">Unassigned</option>
                </select>
              </div>
              <div style={{ flex: "0 0 200px" }}>
                <div style={filterLabelStyle}>Flag Type</div>
                <select value={flagCategoryFilter} onChange={(e) => setFlagCategoryFilter(e.target.value)} style={inputStyle}>
                  <option value="">All flag types</option>
                  {FLAG_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "0 0 170px" }}>
                <div style={filterLabelStyle}>From Date</div>
                <input type="date" value={flagDateFrom} onChange={(e) => setFlagDateFrom(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: "0 0 170px" }}>
                <div style={filterLabelStyle}>To Date</div>
                <input type="date" value={flagDateTo} onChange={(e) => setFlagDateTo(e.target.value)} style={inputStyle} />
              </div>
              {(flagStatusFilter !== "open" || flagChildFilter || flagClassroomFilter || flagCategoryFilter || flagDateFrom || flagDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setFlagStatusFilter("open");
                    setFlagChildFilter("");
                    setFlagClassroomFilter("");
                    setFlagCategoryFilter("");
                    setFlagDateFrom("");
                    setFlagDateTo("");
                  }}
                  style={{ ...secondaryButtonStyle, alignSelf: "flex-end", fontSize: 12, padding: "10px 14px" }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "var(--admin-text-muted)", fontWeight: 600 }}>
              {flagSummary.openCount} open flag{flagSummary.openCount === 1 ? "" : "s"} and {flagSummary.closedCount} closed flag{flagSummary.closedCount === 1 ? "" : "s"}
              {dashboardCenterId && centerById[dashboardCenterId]?.name ? (
                <> in {centerById[dashboardCenterId].name}</>
              ) : null}
            </div>

            {error && !modalOpen ? <ErrorBanner message={error} /> : null}

            <div style={{ marginTop: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-bg-secondary)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--admin-text)" }}>Flag Queue</div>
                <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 2 }}>
                  Only flagged items are shown here.
                </div>
                <div style={{ marginTop: 12 }}>
                  {flagsLoading ? (
                    <SkeletonTable rows={6} cols={4} />
                  ) : flagItems.length === 0 ? (
                    <EmptyState
                      title="No flags found"
                      description="Try changing the child, classroom, status, or date filters."
                      className="py-8"
                    />
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {flagItems.map((item) => {
                        const tone = FLAG_STYLE_BY_TYPE[item.flagType] || {
                          bg: "#F3F4F6",
                          text: "#374151",
                          border: "#E5E7EB",
                        };
                        const isSelected = selectedFlagKey === item.flagKey;
                        const isSaving = flagSavingKey === item.flagKey;
                        return (
                          <div
                            key={item.flagKey}
                            onClick={() => setSelectedFlagKey(item.flagKey)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedFlagKey(item.flagKey);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: isSelected ? "1px solid #60A5FA" : "1px solid var(--admin-border)",
                              background: isSelected ? "#EFF6FF" : "#fff",
                              display: "grid",
                              gap: 8,
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      borderRadius: 999,
                                      border: `1px solid ${tone.border}`,
                                      background: tone.bg,
                                      color: tone.text,
                                      padding: "4px 8px",
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {item.title}
                                  </span>
                                  {item.status === "CLOSED" ? (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>Closed</span>
                                  ) : null}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "var(--admin-text)" }}>
                                  {item.child?.name || "Child"}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                                  {item.summary || "No summary provided."}
                                </div>
                              </div>
                              {item.status === "OPEN" ? (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateFlagReview(item, "close");
                                  }}
                                  style={{
                                    flexShrink: 0,
                                    width: 24,
                                    height: 24,
                                    borderRadius: 999,
                                    border: "1px solid #10B981",
                                    color: "#10B981",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 14,
                                    fontWeight: 900,
                                    background: isSaving ? "#ECFDF5" : "#fff",
                                    cursor: isSaving ? "wait" : "pointer",
                                  }}
                                  role="button"
                                  aria-label="Close flag"
                                >
                                  {isSaving ? "…" : "✓"}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--admin-text-muted)" }}>
                              <span>{item.classRoom?.name || "Unassigned"}</span>
                              <span>{formatFlagDate(item.triggeredAt)}</span>
                              {item.closedAt ? <span>Closed {formatFlagDate(item.closedAt)}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-bg-secondary)" }}>
                {selectedFlagItem ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Flag Detail
                        </div>
                        <h3 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800, color: "var(--admin-text)" }}>
                          {selectedFlagItem.child?.name}
                        </h3>
                        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                          {selectedFlagItem.title}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {selectedFlagItem.status === "OPEN" ? (
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => updateFlagReview(selectedFlagItem, "close")}
                            disabled={flagSavingKey === selectedFlagItem.flagKey}
                          >
                            {flagSavingKey === selectedFlagItem.flagKey ? "Saving..." : "Mark Closed"}
                          </button>
                        ) : selectedFlagItem.active ? (
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => updateFlagReview(selectedFlagItem, "open")}
                            disabled={flagSavingKey === selectedFlagItem.flagKey}
                          >
                            {flagSavingKey === selectedFlagItem.flagKey ? "Saving..." : "Reopen"}
                          </button>
                        ) : null}
                        <button type="button" style={secondaryButtonStyle} onClick={() => openProfile(selectedFlagItem.child?.id)}>
                          View Child Profile
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: "var(--admin-text-muted)", lineHeight: 1.5 }}>
                      {selectedFlagItem.summary || "No summary provided."}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <div style={infoBoxStyle}>
                        <div style={fieldLabelStyle}>Status</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                          {selectedFlagItem.status === "OPEN" ? "Open" : "Closed"}
                        </div>
                      </div>
                      <div style={infoBoxStyle}>
                        <div style={fieldLabelStyle}>Classroom</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                          {selectedFlagItem.classRoom?.name || "Unassigned"}
                        </div>
                      </div>
                      <div style={infoBoxStyle}>
                        <div style={fieldLabelStyle}>Triggered</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                          {formatFlagDate(selectedFlagItem.triggeredAt)}
                        </div>
                      </div>
                      {selectedFlagItem.closedAt ? (
                        <div style={infoBoxStyle}>
                          <div style={fieldLabelStyle}>Closed</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                            {formatFlagDate(selectedFlagItem.closedAt)}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {Array.isArray(selectedFlagItem.details?.fields) && selectedFlagItem.details.fields.length > 0 ? (
                      <div style={infoBoxStyle}>
                        <SectionHeader icon="⚑" title="Details" />
                        <div style={{ display: "grid", gap: 10 }}>
                          {selectedFlagItem.details.fields.map((field, index) => (
                            <div key={`${field.label}-${index}`} style={{ display: "grid", gap: 4 }}>
                              <div style={fieldLabelStyle}>{field.label}</div>
                              <div style={{ fontSize: 13, color: "var(--admin-text)" }}>{field.value || "—"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedFlagItem.details?.notes ? (
                      <div style={infoBoxStyle}>
                        <SectionHeader icon="📝" title="Notes" />
                        <div style={{ fontSize: 13, color: "var(--admin-text)", whiteSpace: "pre-wrap" }}>
                          {selectedFlagItem.details.notes}
                        </div>
                      </div>
                    ) : null}

                    {Array.isArray(selectedFlagItem.details?.items) && selectedFlagItem.details.items.length > 0 ? (
                      <div style={infoBoxStyle}>
                        <SectionHeader icon="📌" title="Related Entries" />
                        <div style={{ display: "grid", gap: 8 }}>
                          {selectedFlagItem.details.items.map((entry, index) => (
                            <div
                              key={entry.id || `${entry.title}-${index}`}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid var(--admin-border)",
                                background: "#fff",
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                                {entry.title || "Entry"}
                              </div>
                              {entry.subtitle ? (
                                <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                                  {formatFlagDate(entry.subtitle)}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedFlagItem.status === "CLOSED" && !selectedFlagItem.active ? (
                      <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                        This item is closed history only. The source issue is no longer active.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a flag"
                    description="Choose a flagged item from the list to review the details."
                    className="py-8"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
        {/* Search & Filter Bar */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 280px", minWidth: 200 }}>
            <div style={filterLabelStyle}>Search</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--admin-text-muted)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36 }}
                placeholder="Search by name or ID..."
              />
            </div>
          </div>
          <div style={{ flex: "0 0 200px" }}>
            <div style={filterLabelStyle}>Classroom</div>
            <select
              value={classroomFilter}
              onChange={(e) => setClassroomFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All classrooms</option>
              {classroomOptions.map((classroom) => {
                const centerName = centerById[classroom.centerId]?.name || "";
                return (
                  <option key={classroom.id} value={classroom.id}>
                    {centerName ? `${classroom.name} - ${centerName}` : classroom.name}
                  </option>
                );
              })}
              <option value="__unassigned__">
                Unassigned
              </option>
            </select>
          </div>
          <div style={{ flex: "0 0 220px" }}>
            <div style={filterLabelStyle}>Profile Status</div>
            <select
              value={profileFlagFilter}
              onChange={(e) => setProfileFlagFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All profiles</option>
              <option value="missing-profile">Missing DOB or classroom</option>
            </select>
          </div>
          {(q || classroomFilter || profileFlagFilter) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setClassroomFilter("");
                setProfileFlagFilter("");
              }}
              style={{ ...secondaryButtonStyle, alignSelf: "flex-end", fontSize: 12, padding: "10px 14px" }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Result count */}
        {!loading && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--admin-text-muted)", fontWeight: 600 }}>
            Showing {filteredSorted.length} of {scopedChildren.length} children
            {q && <> matching &quot;{q}&quot;</>}
            {dashboardCenterId && centerById[dashboardCenterId]?.name ? (
              <> in {centerById[dashboardCenterId].name}</>
            ) : null}
          </div>
        )}

        {profileFlagFilter === "missing-profile" && !loading ? (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #FDE68A",
              background: "#FFFBEB",
              color: "#92400E",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <div>
              Showing {scopedFlaggedChildren.length} child{scopedFlaggedChildren.length === 1 ? "" : "ren"} missing a date of birth, a classroom assignment, or both.
            </div>
            {scopedFlaggedChildren.length > 0 ? (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {scopedFlaggedChildren.slice(0, 5).map(({ child, issues }) => (
                  <div
                    key={child.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.7)",
                      border: "1px solid #FCD34D",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#78350F" }}>
                        {childFullName(child)}
                      </div>
                      <div style={{ fontSize: 12, color: "#92400E" }}>
                        {issues.join(" • ")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openProfile(child.id)}
                      style={{
                        ...secondaryButtonStyle,
                        background: "#fff",
                        borderColor: "#F59E0B",
                        color: "#92400E",
                      }}
                    >
                      View Profile
                    </button>
                  </div>
                ))}
                {scopedFlaggedChildren.length > 5 ? (
                  <div style={{ fontSize: 12, color: "#92400E" }}>
                    {scopedFlaggedChildren.length - 5} more flagged child{scopedFlaggedChildren.length - 5 === 1 ? "" : "ren"} in this list.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: "1px solid var(--admin-border)", background: "var(--admin-bg-secondary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--admin-text)" }}>Document Report</div>
              <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 2 }}>
                Filter by document type, expiration date, and family before printing.
              </div>
            </div>
            <button type="button" style={secondaryButtonStyle} onClick={printDocumentReport}>
              Print Report
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
            <div>
              <div style={filterLabelStyle}>Document Type</div>
              <select value={docReportType} onChange={(e) => setDocReportType(e.target.value)} style={inputStyle}>
                <option value="">All documents</option>
                {CHILD_DOCUMENT_TYPES.map((type) => (
                  <option key={type.field} value={type.field}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={filterLabelStyle}>Family</div>
              <input
                value={docReportFamily}
                onChange={(e) => setDocReportFamily(e.target.value)}
                style={inputStyle}
                placeholder="Family or child name"
              />
            </div>
            <div>
              <div style={filterLabelStyle}>Expiration From</div>
              <input
                type="date"
                value={docReportExpirationFrom}
                onChange={(e) => setDocReportExpirationFrom(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={filterLabelStyle}>Expiration To</div>
              <input
                type="date"
                value={docReportExpirationTo}
                onChange={(e) => setDocReportExpirationTo(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--admin-text-muted)", fontWeight: 700 }}>
              {documentReportRows.length} matching document{documentReportRows.length === 1 ? "" : "s"}
            </span>
            {(docReportType || docReportFamily || docReportExpirationFrom || docReportExpirationTo) && (
              <button
                type="button"
                onClick={() => {
                  setDocReportType("");
                  setDocReportFamily("");
                  setDocReportExpirationFrom("");
                  setDocReportExpirationTo("");
                }}
                style={{ ...secondaryButtonStyle, fontSize: 12, padding: "7px 10px" }}
              >
                Clear Report Filters
              </button>
            )}
          </div>
        </div>

        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {/* Children List */}
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <SkeletonTable rows={5} cols={7} />
          ) : filteredSorted.length === 0 ? (
            <EmptyState
              title="No children found"
              description={q || classroomFilter || profileFlagFilter ? "Try adjusting your search or filters." : "Get started by adding your first child record."}
              actionLabel={!q && !classroomFilter && !profileFlagFilter ? "+ Add Child" : undefined}
              onAction={!q && !classroomFilter && !profileFlagFilter ? openCreate : undefined}
              className="py-8"
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {filteredSorted.map((ch) => {
                const fullName = `${ch.firstName || ""} ${ch.lastName || ""}`.trim();
                const age = childAgeGroup(ch);
                const ageColor = AGE_COLORS[age] || AGE_COLORS["Unknown"];
                const centerName = centerById[ch.centerId]?.name || "—";
                const defaultClassRoomId = getDefaultClassRoomId(ch);
                const effectiveClassRoomId = getEffectiveClassRoomId(ch);
                const className = effectiveClassRoomId ? (classById[effectiveClassRoomId]?.name || effectiveClassRoomId) : null;
                const defaultClassName = defaultClassRoomId ? (classById[defaultClassRoomId]?.name || defaultClassRoomId) : null;
                const movedToday = !!ch.hasTemporaryClassRoomToday;
                const checkedInToday = isChildCheckedInToday(ch);
                const rowAttendanceSaving = rowAttendanceSavingId === ch.id;
                const rowTransferSaving = rowTransferSavingId === ch.id;
                const selectedTransferClassRoomId = quickTransferValue(ch);
                const profileIssues = profileFlagIssuesByChildId[ch.id] || [];
                const linkedParents = getLinkedParentUsers(ch).map(formatLinkedParentAccount).filter(Boolean);
                const parentSummaries = getParentContacts(ch)
                  .map((contact) => formatContactLine(contact))
                  .filter(Boolean);
                const emergencySummary = getEmergencyContacts(ch)
                  .map((contact) => formatContactLine(contact, { includeEmail: false }))
                  .filter(Boolean);

                return (
                  <div
                    key={ch.id}
                    style={childCardStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Avatar */}
                    <div style={avatarStyle}>
                      {getInitials(ch)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>
                          {fullName || "Unnamed"}
                        </span>
                        <span style={{ ...ageBadgeStyle, background: ageColor.bg, color: ageColor.text, borderColor: ageColor.border }}>
                          {age === "Unknown" ? "Age unknown" : `${age} yr`}
                        </span>
                        {ch.allergies && (
                          <span style={{ ...tagStyle, background: "#FEE2E2", color: "#991B1B", borderColor: "#FECACA" }}>
                            ⚠ Allergies
                          </span>
                        )}
                        {movedToday && (
                          <span style={{ ...tagStyle, background: "#E0F2FE", color: "#075985", borderColor: "#BAE6FD" }}>
                            Moved Today
                          </span>
                        )}
                        {!effectiveClassRoomId && (
                          <span style={{ ...tagStyle, background: "#FEF3C7", color: "#92400E", borderColor: "#FDE68A" }}>
                            No class
                          </span>
                        )}
                        {profileIssues.includes("Missing DOB") && (
                          <span style={{ ...tagStyle, background: "#FEF2F2", color: "#991B1B", borderColor: "#FECACA" }}>
                            Missing DOB
                          </span>
                        )}
                        {profileIssues.includes("Missing classroom") && !profileIssues.includes("Missing DOB") && (
                          <span style={{ ...tagStyle, background: "#FFF7ED", color: "#9A3412", borderColor: "#FED7AA" }}>
                            Missing classroom
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap", fontSize: 12, color: "var(--admin-text-muted)" }}>
                        {ch.birthDate && (
                          <span>Born {new Date(ch.birthDate).toLocaleDateString()}</span>
                        )}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
                          {centerName}
                        </span>
                        {className && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                            {movedToday ? `Today: ${className}` : className}
                          </span>
                        )}
                        {linkedParents[0] && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Linked: {linkedParents[0]}
                          </span>
                        )}
                      </div>

                      {linkedParents.length > 1 || parentSummaries.length > 0 || emergencySummary.length > 0 ? (
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--admin-text-muted)" }}>
                          {linkedParents.length > 1 ? `Linked 2: ${linkedParents[1]}` : null}
                          {linkedParents.length > 1 && parentSummaries.length > 0 ? " • " : null}
                          {parentSummaries.length > 0 ? `Contacts: ${parentSummaries.join(" • ")}` : null}
                          {((linkedParents.length > 1) || parentSummaries.length > 0) && emergencySummary.length > 0 ? " • " : null}
                          {emergencySummary.length > 0 ? `Emergency: ${emergencySummary.join(" • ")}` : null}
                        </div>
                      ) : null}

                      {(ch.enrollmentStartDate || ch.enrollmentEndDate) && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--admin-text-muted)" }}>
                          Enrolled: {ch.enrollmentStartDate ? new Date(ch.enrollmentStartDate).toLocaleDateString() : "—"} — {ch.enrollmentEndDate ? new Date(ch.enrollmentEndDate).toLocaleDateString() : "Present"}
                        </div>
                      )}
                      {movedToday && defaultClassName ? (
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--admin-text-muted)" }}>
                          Default classroom: {defaultClassName}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 10,
                          display: "grid",
                          gap: 8,
                          borderTop: "1px solid var(--admin-border)",
                          paddingTop: 10,
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)" }}>
                            Today: {checkedInToday ? "Checked in" : "Not checked in"}
                          </span>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => updateChildAttendanceFromCard(ch, "CHECK_IN")}
                            disabled={checkedInToday || rowAttendanceSaving || rowTransferSaving}
                          >
                            {rowAttendanceSaving && !checkedInToday ? "Saving..." : "Check In"}
                          </button>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => updateChildAttendanceFromCard(ch, "CHECK_OUT")}
                            disabled={!checkedInToday || rowAttendanceSaving || rowTransferSaving}
                          >
                            {rowAttendanceSaving && checkedInToday ? "Saving..." : "Check Out"}
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <select
                            value={selectedTransferClassRoomId}
                            onChange={(e) => updateQuickTransferValue(ch.id, e.target.value)}
                            style={{ ...inputStyle, minWidth: 240, maxWidth: 320, background: "#fff" }}
                            disabled={!checkedInToday || rowTransferSaving}
                          >
                            <option value="">Return to default classroom</option>
                            {classes
                              .filter((cl) => cl.centerId === ch.centerId)
                              .map((cl) => (
                                <option key={cl.id} value={cl.id}>
                                  {cl.name}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => saveChildTransferFromCard(ch, selectedTransferClassRoomId)}
                            disabled={!checkedInToday || rowTransferSaving}
                          >
                            {rowTransferSaving ? "Saving..." : "Transfer for Today"}
                          </button>
                          {ch.hasTemporaryClassRoomToday ? (
                            <button
                              type="button"
                              style={secondaryButtonStyle}
                              onClick={() => {
                                updateQuickTransferValue(ch.id, "");
                                saveChildTransferFromCard(ch, "");
                              }}
                              disabled={!checkedInToday || rowTransferSaving}
                            >
                              Return to Default
                            </button>
                          ) : null}
                        </div>

                        {!checkedInToday ? (
                          <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
                            Temporary classroom transfer is available after the child is checked in.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <button
                        type="button"
                        style={cardActionButton}
                        onClick={() => openProfile(ch.id)}
                        title="View profile"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        style={cardActionButton}
                        onClick={() => openEdit(ch)}
                        title="Edit"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        style={cardDangerButton}
                        onClick={() => setDeleteConfirmId(ch.id)}
                        title="Delete"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {(profileLoading || profileChild) ? (
        <Modal
          title={profileLoading ? "Loading Child Profile" : childFullName(profileChild)}
          onClose={closeProfile}
        >
          {profileLoading ? (
            <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Loading profile…</div>
          ) : profileChild ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div style={infoBoxStyle}>
                  <div style={fieldLabelStyle}>Center</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                    {centerById[profileChild.centerId]?.name || "—"}
                  </div>
                </div>
                <div style={infoBoxStyle}>
                  <div style={fieldLabelStyle}>Today's Classroom</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                    {getEffectiveClassRoomId(profileChild) ? (classById[getEffectiveClassRoomId(profileChild)]?.name || getEffectiveClassRoomId(profileChild)) : "Unassigned"}
                  </div>
                </div>
                <div style={infoBoxStyle}>
                  <div style={fieldLabelStyle}>Birth Date</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                    {profileChild.birthDate ? new Date(profileChild.birthDate).toLocaleDateString() : "—"}
                  </div>
                </div>
                <div style={infoBoxStyle}>
                  <div style={fieldLabelStyle}>Linked Parents</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                    {(() => {
                      const linkedParents = getLinkedParentUsers(profileChild)
                        .map(formatLinkedParentAccount)
                        .filter(Boolean);
                      return linkedParents.length ? linkedParents.join(" • ") : "—";
                    })()}
                  </div>
                </div>
              </div>

              <div style={infoBoxStyle}>
                <SectionHeader icon="🕒" title="Attendance Today" />
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                    Status: {isChildCheckedInToday(profileChild) ? "Checked in" : "Not checked in"}
                  </div>
                  {profileChild.todayAttendance?.checkedInAt ? (
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                      Checked in at: {formatDateTime(profileChild.todayAttendance.checkedInAt)}
                    </div>
                  ) : null}
                  {profileChild.todayAttendance?.checkedOutAt ? (
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                      Checked out at: {formatDateTime(profileChild.todayAttendance.checkedOutAt)}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={() => updateProfileAttendance("CHECK_IN")}
                      disabled={isChildCheckedInToday(profileChild) || attendanceSaving || transferSaving}
                    >
                      {attendanceSaving && !isChildCheckedInToday(profileChild) ? "Saving..." : "Check In"}
                    </button>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={() => updateProfileAttendance("CHECK_OUT")}
                      disabled={!isChildCheckedInToday(profileChild) || attendanceSaving || transferSaving}
                    >
                      {attendanceSaving && isChildCheckedInToday(profileChild) ? "Saving..." : "Check Out"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={infoBoxStyle}>
                <SectionHeader icon="🏫" title="Temporary Classroom Transfer" />
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                    Default classroom: {getDefaultClassRoomId(profileChild) ? (classById[getDefaultClassRoomId(profileChild)]?.name || getDefaultClassRoomId(profileChild)) : "Unassigned"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                    Status today: {isChildCheckedInToday(profileChild) ? "Checked in and eligible for classroom transfer" : "Not currently checked in"}
                  </div>
                  <select
                    value={profileTransferClassRoomId}
                    onChange={(e) => setProfileTransferClassRoomId(e.target.value)}
                    style={inputStyle}
                    disabled={!isChildCheckedInToday(profileChild) || transferSaving}
                  >
                    <option value="">Return to default classroom</option>
                    {classes
                      .filter((cl) => cl.centerId === profileChild.centerId)
                      .map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.name}
                        </option>
                      ))}
                  </select>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={saveProfileTransfer}
                      disabled={!isChildCheckedInToday(profileChild) || transferSaving}
                    >
                      {transferSaving ? "Saving..." : "Save for Today"}
                    </button>
                    {profileChild.hasTemporaryClassRoomToday ? (
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        onClick={() => {
                          setProfileTransferClassRoomId("");
                          saveProfileTransfer("");
                        }}
                        disabled={!isChildCheckedInToday(profileChild) || transferSaving}
                      >
                        Return to Default
                      </button>
                    ) : null}
                  </div>
                  {!isChildCheckedInToday(profileChild) ? (
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                      Transfer is available only while the child is checked in. The default classroom stays unchanged and resumes tomorrow.
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                <div style={infoBoxStyle}>
                  <SectionHeader icon="📝" title="Recent Logs" />
                  {(profileChild.activities || []).length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {profileChild.activities.slice(0, 8).map((activity) => (
                        <div key={activity.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                              {activity.type === "OTHER" && activity?.details?.kind === "DAILY_GRADE"
                                ? "Grade"
                                : String(activity.type || "OTHER").replace(/_/g, " ")}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{formatDateTime(activity.createdAt)}</div>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                            {activity.notes || "No notes recorded."}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>No activity logs yet.</div>
                  )}
                </div>

                <div style={infoBoxStyle}>
                  <SectionHeader icon="📊" title="Assessments" />
                  {extractAssessmentRows(profileChild.activities).length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {extractAssessmentRows(profileChild.activities).slice(0, 8).map((assessment) => (
                        <div key={assessment.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                              {assessment.domains ? "Developmental Assessment" : "Grade"}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{formatDateTime(assessment.createdAt)}</div>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                            {assessment.domains ? Object.entries(assessment.domains).map(([domain, value]) => `${domain}: ${value}`).join(" • ") : assessment.grade !== null ? `Grade: ${assessment.grade}/10` : "Assessment logged"}
                          </div>
                          {assessment.notes ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>{assessment.notes}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>No assessments yet.</div>
                  )}
                </div>
              </div>

              <div style={infoBoxStyle}>
                <SectionHeader icon="📈" title="Progress" />
                {(profileChild.progress || []).length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {profileChild.progress.slice(0, 10).map((progress) => (
                      <div key={progress.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                            {progress.lesson?.title || "Lesson progress"}
                          </div>
                          <span style={{ ...tagStyle, background: "#EFF6FF", color: "#1D4ED8", borderColor: "#BFDBFE" }}>
                            {progress.status || "NOT_STARTED"}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                          Updated {formatDateTime(progress.updatedAt || progress.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>No progress records yet.</div>
                )}
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {/* Modal */}
      {modalOpen ? (
        <Modal
          title={editing ? `Edit — ${editing.firstName} ${editing.lastName || ""}` : "Add New Child"}
          onClose={closeModal}
        >
          {error ? <ErrorBanner message={error} /> : null}

          <form onSubmit={editing ? saveEdit : createChild}>
            {/* Section: Basic Info */}
            <SectionHeader icon="👤" title="Basic Information" />
            <div style={formGridStyle}>
              <Field label="First Name">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                  required
                  placeholder="First name"
                />
              </Field>
              <Field label="Last Name">
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                  placeholder="Last name"
                />
              </Field>
              <Field label="Birth Date">
                <input
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={inputStyle}
                  type="date"
                />
              </Field>
              <Field label="Enrollment Start">
                <input
                  value={enrollmentStartDate}
                  onChange={(e) => setEnrollmentStartDate(e.target.value)}
                  style={inputStyle}
                  type="date"
                />
              </Field>
              <Field label="Enrollment End">
                <input
                  value={enrollmentEndDate}
                  onChange={(e) => setEnrollmentEndDate(e.target.value)}
                  style={inputStyle}
                  type="date"
                />
              </Field>
            </div>

            {/* Section: Placement */}
            <SectionHeader icon="🏫" title="Placement" style={{ marginTop: 20 }} />
            <div style={formGridStyle}>
              <Field label={editing ? "Center (set at creation)" : "Center"}>
                <select
                  value={centerId}
                  onChange={(e) => setCenterId(e.target.value)}
                  style={inputStyle}
                  required={!editing}
                  disabled={!!editing}
                >
                  <option value="">
                    {editing ? "(unchanged)" : "Select a center"}
                  </option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Classroom">
                <select
                  value={classRoomId}
                  onChange={(e) => setClassRoomId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">(none)</option>
                  {classes
                    .filter((cl) => !centerId || cl.centerId === centerId)
                    .map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name}
                      </option>
                    ))}
                </select>
              </Field>
              {parentAccountIds.map((parentAccountId, index) => (
                <Field key={`linked-parent-${index + 1}`} label={`Linked Parent Account ${index + 1}`}>
                  <select
                    value={parentAccountId}
                    onChange={(e) => updateParentAccount(index, e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">(optional)</option>
                    {parents.map((p) => {
                      const alreadySelected = parentAccountIds.some(
                        (selectedId, selectedIndex) =>
                          selectedIndex !== index && selectedId === p.id,
                      );
                      return (
                        <option key={p.id} value={p.id} disabled={alreadySelected}>
                          {p.email || p.name || p.id}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              ))}
            </div>

            {!editing ? (
              <>
                <SectionHeader
                  icon="Copy"
                  title="Copy Family Contacts"
                  style={{ marginTop: 20 }}
                />
                <div style={formGridStyle}>
                  <Field label="Copy from another child">
                    <select
                      value={copyContactsFromChildId}
                      onChange={(e) => {
                        const nextChildId = e.target.value;
                        setCopyContactsFromChildId(nextChildId);
                        if (nextChildId) applyContactTemplate(nextChildId);
                      }}
                      style={inputStyle}
                    >
                      <option value="">(optional)</option>
                      {contactTemplateChildren.map((child) => (
                        <option key={child.id} value={child.id}>
                          {childFullName(child)}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--admin-text-muted)" }}>
                      Copies linked parent accounts, parent contacts, and emergency contacts into this new child record.
                    </div>
                  </Field>
                </div>
              </>
            ) : null}

            <SectionHeader icon="👪" title="Parent Contacts" style={{ marginTop: 20 }} />
            <div style={formGridStyle}>
              {parentContacts.map((contact, index) => (
                <div
                  key={contact.label}
                  style={{
                    border: "1px solid var(--admin-border)",
                    borderRadius: 12,
                    padding: 14,
                    background: "var(--admin-bg-secondary)",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: "var(--admin-text)", marginBottom: 10 }}>
                    {contact.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    <Field label="Name">
                      <input
                        value={contact.name}
                        onChange={(e) => updateParentContact(index, "name", e.target.value)}
                        style={inputStyle}
                        placeholder={contact.label}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        value={contact.email}
                        onChange={(e) => updateParentContact(index, "email", e.target.value)}
                        style={inputStyle}
                        placeholder="name@example.com"
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        value={contact.phone}
                        onChange={(e) => updateParentContact(index, "phone", e.target.value)}
                        style={inputStyle}
                        placeholder="(555) 000-0000"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            {/* Section: Health & Safety */}
            <SectionHeader icon="🏥" title="Health & Safety" style={{ marginTop: 20 }} />
            <div style={formGridStyle}>
              {emergencyContacts.map((contact, index) => (
                <div
                  key={contact.label}
                  style={{
                    border: "1px solid var(--admin-border)",
                    borderRadius: 12,
                    padding: 14,
                    background: "var(--admin-bg-secondary)",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: "var(--admin-text)", marginBottom: 10 }}>
                    {contact.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    <Field label="Name">
                      <input
                        value={contact.name}
                        onChange={(e) => updateEmergencyContact(index, "name", e.target.value)}
                        style={inputStyle}
                        placeholder="Emergency contact name"
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        value={contact.phone}
                        onChange={(e) => updateEmergencyContact(index, "phone", e.target.value)}
                        style={inputStyle}
                        placeholder="(555) 000-0000"
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <Field label="Allergies/Special Notes">
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. peanuts, dairy"
                />
              </Field>
              <Field label="Carpool (optional)">
                <input
                  value={carpool}
                  onChange={(e) => setCarpool(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. School 1"
                />
              </Field>
            </div>

            {/* Feeding Plan (infants only) */}
            {isInfant ? (
              <>
                <SectionHeader icon="🍼" title="Feeding Plan (0-1 years)" style={{ marginTop: 20 }} />
                <div style={formGridStyle}>
                  <Field label="What they eat">
                    <input
                      value={feedingFoods}
                      onChange={(e) => setFeedingFoods(e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. purees, solids"
                    />
                  </Field>
                  <Field label="Formula">
                    <input
                      value={feedingFormula}
                      onChange={(e) => setFeedingFormula(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="# Bottles / day">
                    <input
                      value={feedingBottlesPerDay}
                      onChange={(e) => setFeedingBottlesPerDay(e.target.value)}
                      style={inputStyle}
                      inputMode="numeric"
                      placeholder="e.g. 4"
                    />
                  </Field>
                  <Field label="Bottle notes">
                    <input
                      value={feedingBottleNotes}
                      onChange={(e) => setFeedingBottleNotes(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </>
            ) : null}

            {/* Section: Documents */}
            <SectionHeader icon="📄" title="Documents" style={{ marginTop: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              <Field label="Health Assessment">
                <input
                  type="file"
                  multiple
                  onChange={(e) =>
                    setHealthAssessmentFiles(Array.from(e.target.files || []))
                  }
                  style={inputStyle}
                />
                <input
                  type="date"
                  value={documentExpirations.healthAssessmentDocuments}
                  onChange={(e) => updateDocumentExpiration("healthAssessmentDocuments", e.target.value)}
                  style={{ ...inputStyle, marginTop: 6 }}
                  title="Expiration date"
                />
                {healthAssessmentDocuments.length > 0 && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {healthAssessmentDocuments.map((d, idx) => (
                      <DocRow
                        key={`${d?.url || "doc"}-${idx}`}
                        doc={d}
                        onRemove={() =>
                          setHealthAssessmentDocuments((cur) =>
                            cur.filter((_, i) => i !== idx),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Enrollment Documents">
                <input
                  type="file"
                  multiple
                  onChange={(e) =>
                    setEnrollmentFiles(Array.from(e.target.files || []))
                  }
                  style={inputStyle}
                />
                <input
                  type="date"
                  value={documentExpirations.enrollmentDocuments}
                  onChange={(e) => updateDocumentExpiration("enrollmentDocuments", e.target.value)}
                  style={{ ...inputStyle, marginTop: 6 }}
                  title="Expiration date"
                />
                {enrollmentDocuments.length > 0 && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {enrollmentDocuments.map((d, idx) => (
                      <DocRow
                        key={`${d?.url || "doc"}-${idx}`}
                        doc={d}
                        onRemove={() =>
                          setEnrollmentDocuments((cur) =>
                            cur.filter((_, i) => i !== idx),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </Field>
              <DocumentUploadField
                label="IEF"
                filesSetter={setIefFiles}
                docs={iefDocuments}
                onRemove={(idx) => setIefDocuments((cur) => cur.filter((_, i) => i !== idx))}
                expirationValue={documentExpirations.iefDocuments}
                onExpirationChange={(value) => updateDocumentExpiration("iefDocuments", value)}
              />
              <DocumentUploadField
                label="Immunizations"
                filesSetter={setImmunizationFiles}
                docs={immunizationDocuments}
                onRemove={(idx) => setImmunizationDocuments((cur) => cur.filter((_, i) => i !== idx))}
                expirationValue={documentExpirations.immunizationDocuments}
                onExpirationChange={(value) =>
                  updateDocumentExpiration("immunizationDocuments", value)
                }
              />
              <DocumentUploadField
                label="Infant Documents"
                filesSetter={setInfantFiles}
                docs={infantDocuments}
                onRemove={(idx) => setInfantDocuments((cur) => cur.filter((_, i) => i !== idx))}
                expirationValue={documentExpirations.infantDocuments}
                onExpirationChange={(value) => updateDocumentExpiration("infantDocuments", value)}
              />
              <DocumentUploadField
                label="Other"
                filesSetter={setOtherFiles}
                docs={otherDocuments}
                onRemove={(idx) => setOtherDocuments((cur) => cur.filter((_, i) => i !== idx))}
                expirationValue={documentExpirations.otherDocuments}
                onExpirationChange={(value) => updateDocumentExpiration("otherDocuments", value)}
              />
            </div>

            {/* Steps of Progression (edit only) */}
            {editing ? (
              <>
                <SectionHeader icon="📈" title="Steps of Progression" style={{ marginTop: 20 }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
                  <div style={filterLabelStyle}>Domain:</div>
                  <select
                    value={stepsDomain}
                    onChange={(e) => setStepsDomain(e.target.value)}
                    style={{ ...inputStyle, width: "auto", minWidth: 160 }}
                  >
                    <option value="">All domains</option>
                    {stepDomains.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {stepsError ? <ErrorBanner message={stepsError} /> : null}

                {stepsLoading ? (
                  <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Loading steps...</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    <StepsGroup
                      title="Catch-up (Overdue)"
                      rows={catchupRows}
                      onToggle={setChecklistItemCompleted}
                      variant="danger"
                    />
                    <StepsGroup
                      title="Currently Working On"
                      rows={currentRows}
                      onToggle={setChecklistItemCompleted}
                      variant="info"
                    />
                    <StepsGroup
                      title="Upcoming"
                      rows={upcomingRows}
                      onToggle={setChecklistItemCompleted}
                      variant="muted"
                    />
                  </div>
                )}
              </>
            ) : null}

            {/* Transfer Record (edit only) */}
            {editing && (
              <>
                <SectionHeader icon="📦" title="Transfer Record" style={{ marginTop: 20 }} />
                <div style={infoBoxStyle}>
                  <p style={{ color: "var(--admin-text-muted)", fontSize: 12, margin: 0 }}>
                    Download a comprehensive record package for child transfer.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button type="button" style={secondaryButtonStyle} onClick={() => window.open(`/api/v1/children/${editing.id}/transfer-record?format=json`, "_blank")}>
                      Export JSON
                    </button>
                    <button type="button" style={secondaryButtonStyle} onClick={() => window.open(`/api/v1/children/${editing.id}/transfer-record?format=csv`, "_blank")}>
                      Export CSV
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Permissions (edit only) */}
            {editing && (
              <>
                <SectionHeader icon="🔒" title="Permissions" style={{ marginTop: 20 }} />
                <p style={{ color: "var(--admin-text-muted)", fontSize: 12, margin: "0 0 10px" }}>
                  Manage photo release, field trip, medical treatment, and other permissions.
                </p>
                {permissionsLoading ? (
                  <div style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Loading permissions...</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                    {[
                      { value: "PHOTO_RELEASE", label: "Photo Release", icon: "📷" },
                      { value: "FIELD_TRIP", label: "Field Trip", icon: "🚌" },
                      { value: "MEDICAL_TREATMENT", label: "Medical Treatment", icon: "🏥" },
                      { value: "TRANSPORTATION", label: "Transportation", icon: "🚗" },
                      { value: "SUNSCREEN_APPLICATION", label: "Sunscreen", icon: "☀️" },
                      { value: "WATER_ACTIVITIES", label: "Water Activities", icon: "💧" },
                    ].map((pt) => {
                      const perm = childPermissions.find((p) => p.permissionType === pt.value);
                      const status = perm?.status || "PENDING";
                      return (
                        <PermissionCard
                          key={pt.value}
                          pt={pt}
                          status={status}
                          editingId={editing.id}
                          setChildPermissions={setChildPermissions}
                          setError={setError}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Form Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--admin-border)" }}>
              <button type="button" style={secondaryButtonStyle} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" style={primaryButtonStyle}>
                {editing ? "Save Changes" : "Create Child"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete Child"
        message="Are you sure you want to delete this child record? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteChild(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: 16, borderRadius: 14,
      background: "var(--admin-bg)",
      border: "1px solid var(--admin-border)",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: bg, fontSize: 22,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, style: extraStyle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, ...extraStyle }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--admin-text)" }}>{title}</span>
    </div>
  );
}

function DocRow({ doc, onRemove }) {
  return (
    <div style={docRowStyle}>
      <div style={{ minWidth: 0 }}>
        <a href={doc.url} target="_blank" rel="noreferrer" style={docLinkStyle}>
          📎 {doc.originalName || doc.url}
        </a>
        {doc.expirationDate ? (
          <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 2 }}>
            Expires {new Date(doc.expirationDate).toLocaleDateString()}
          </div>
        ) : null}
      </div>
      <button type="button" style={miniDangerButtonStyle} onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

function DocumentUploadField({ label, filesSetter, docs, onRemove, expirationValue, onExpirationChange }) {
  return (
    <Field label={label}>
      <input
        type="file"
        multiple
        onChange={(e) => filesSetter(Array.from(e.target.files || []))}
        style={inputStyle}
      />
      <input
        type="date"
        value={expirationValue}
        onChange={(e) => onExpirationChange(e.target.value)}
        style={{ ...inputStyle, marginTop: 6 }}
        title="Expiration date"
      />
      {docs.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {docs.map((d, idx) => (
            <DocRow
              key={`${d?.url || "doc"}-${idx}`}
              doc={d}
              onRemove={() => onRemove(idx)}
            />
          ))}
        </div>
      )}
    </Field>
  );
}

function PermissionCard({ pt, status, editingId, setChildPermissions, setError }) {
  const statusColors = {
    GRANTED: { bg: "var(--admin-success-bg, #D1FAE5)", border: "var(--admin-success-border, #A7F3D0)", text: "#065F46", label: "Granted" },
    DENIED: { bg: "var(--admin-error-bg, #FEE2E2)", border: "var(--admin-error-border, #FECACA)", text: "#991B1B", label: "Denied" },
    PENDING: { bg: "var(--admin-bg-secondary, #F9FAFB)", border: "var(--admin-border)", text: "var(--admin-text-muted)", label: "Pending" },
    REVOKED: { bg: "#F3F4F6", border: "#E5E7EB", text: "#6B7280", label: "Revoked" },
  };
  const sc = statusColors[status] || statusColors.PENDING;

  async function setStatus(newStatus) {
    try {
      await apiJson(`/api/v1/children/${editingId}/permissions`, { method: "POST", body: JSON.stringify({ permissionType: pt.value, status: newStatus }) });
      const perms = await apiJson(`/api/v1/children/${editingId}/permissions`);
      setChildPermissions(Array.isArray(perms) ? perms : []);
    } catch (e3) { setError(e3.message); }
  }

  return (
    <div style={{ padding: 12, border: `1px solid ${sc.border}`, borderRadius: 12, background: sc.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{pt.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{pt.label}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: sc.text, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {sc.label}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        <button type="button" disabled={status === "GRANTED"} style={{ ...permBtnStyle, opacity: status === "GRANTED" ? 0.5 : 1, background: status === "GRANTED" ? "#A7F3D0" : undefined }} onClick={() => setStatus("GRANTED")}>
          Grant
        </button>
        <button type="button" disabled={status === "DENIED"} style={{ ...permBtnStyle, opacity: status === "DENIED" ? 0.5 : 1, background: status === "DENIED" ? "#FECACA" : undefined }} onClick={() => setStatus("DENIED")}>
          Deny
        </button>
        {status !== "PENDING" && (
          <button type="button" style={permBtnStyle} onClick={() => setStatus("REVOKED")}>
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={modalOverlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalCardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--admin-border)" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--admin-text)" }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-muted)" }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StepsGroup({ title, rows, onToggle, variant }) {
  const list = Array.isArray(rows) ? rows : [];
  const colors = {
    danger: { bg: "#FEF2F2", border: "#FECACA", headerColor: "#991B1B" },
    info: { bg: "#EFF6FF", border: "#BFDBFE", headerColor: "#1E40AF" },
    muted: { bg: "var(--admin-bg-secondary)", border: "var(--admin-border)", headerColor: "var(--admin-text-muted)" },
  };
  const c = colors[variant] || colors.muted;

  return (
    <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, padding: 14, background: c.bg }}>
      <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 13, color: c.headerColor, display: "flex", alignItems: "center", gap: 6 }}>
        {title}
        <span style={{ fontWeight: 600, fontSize: 11, opacity: 0.7 }}>({list.length})</span>
      </div>
      {list.length === 0 ? (
        <div style={{ color: "var(--admin-text-muted)", fontSize: 12 }}>No items.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          {list.slice(0, 30).map((r) => {
            const due = r.end instanceof Date && !Number.isNaN(r.end.getTime())
              ? r.end
              : new Date(r.plan.periodStart);
            const dueLabel = `Due ${due.toLocaleDateString()}`;

            return (
              <label key={r.item.id} style={stepRowStyle}>
                <input
                  type="checkbox"
                  checked={!!r.isCompleted}
                  onChange={(e) => onToggle(r.item.id, e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {r.item.title || "Step"}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={stepTagStyle}>{r.domain}</span>
                    <span style={stepTagStyle}>{dueLabel}</span>
                    <span style={stepTagStyle}>{r.plan.title || "Plan"}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, htmlFor }) {
  return (
    <label style={{ display: "block" }} htmlFor={htmlFor}>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </label>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{
      padding: 12, background: "var(--admin-error-bg)", color: "var(--admin-error-text)",
      borderRadius: 10, marginTop: 12, border: "1px solid var(--admin-error-border)", fontSize: 13, fontWeight: 600,
    }}>
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

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  boxSizing: "border-box",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  fontSize: 13,
  transition: "border-color 0.15s",
};

const filterLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const fieldLabelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const childCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const avatarStyle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #1e3a8a, #0ea5e9)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: 14,
  flexShrink: 0,
};

const ageBadgeStyle = {
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tagStyle = {
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
};

const cardActionButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "7px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};

const cardDangerButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 7,
  border: "1px solid #FECACA",
  borderRadius: 8,
  background: "#FEF2F2",
  color: "#DC2626",
  cursor: "pointer",
};

const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 18px",
  background: "linear-gradient(135deg, #1e3a8a, #0284c7)",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const secondaryButtonStyle = {
  padding: "10px 16px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const permBtnStyle = {
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 700,
  border: "1px solid var(--admin-border)",
  borderRadius: 6,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "var(--admin-modal-overlay, rgba(0,0,0,0.5))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCardStyle = {
  width: "min(1100px, 100%)",
  maxHeight: "min(88vh, 920px)",
  overflow: "auto",
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
};

const docRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  background: "var(--admin-bg-secondary)",
};

const docLinkStyle = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
};

const miniDangerButtonStyle = {
  padding: "4px 10px",
  background: "#FEE2E2",
  color: "#DC2626",
  border: "1px solid #FECACA",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 11,
};

const stepRowStyle = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  alignItems: "start",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  background: "var(--admin-bg)",
  cursor: "pointer",
};

const stepTagStyle = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg-tertiary, #F3F4F6)",
  color: "var(--admin-text-secondary, #6B7280)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const infoBoxStyle = {
  padding: 14,
  border: "1px solid var(--admin-border)",
  borderRadius: 12,
  background: "var(--admin-bg-secondary)",
};
