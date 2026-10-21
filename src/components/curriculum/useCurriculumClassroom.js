import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "aca:curriculumClassroom";

function remembered() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function remember(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private windows can block storage; the choice just is not remembered.
  }
}

/**
 * Center and classroom pickers shared by the Lesson Calendar and Lesson
 * Planner tabs. The last classroom chosen is remembered across the tabs.
 */
export default function useCurriculumClassroom() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterIdState] = useState("");
  const [classRoomId, setClassRoomIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJson("/api/v1/centers");
        const list = (Array.isArray(data) ? data : []).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setCenters(list);
        const saved = remembered();
        const center = list.find((c) => c.id === saved.centerId) || list.find((c) => c.name === "Demo Center") || list[0];
        if (center) {
          setCenterIdState(center.id);
          const rooms = center.classes || [];
          setClassRoomIdState((rooms.find((r) => r.id === saved.classRoomId) || rooms[0])?.id || "");
        }
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const classrooms = useMemo(
    () => [...(centers.find((c) => c.id === centerId)?.classes || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [centers, centerId],
  );

  function setCenterId(id) {
    const rooms = [...(centers.find((c) => c.id === id)?.classes || [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const room = rooms[0]?.id || "";
    setCenterIdState(id);
    setClassRoomIdState(room);
    remember({ centerId: id, classRoomId: room });
  }

  function setClassRoomId(id) {
    setClassRoomIdState(id);
    remember({ centerId, classRoomId: id });
  }

  return { centers, centerId, setCenterId, classrooms, classRoomId, setClassRoomId, loading, error };
}

/**
 * Center (when there is more than one) and classroom dropdowns. classroomLabel
 * renames the classroom field (the Lesson Planner calls it "Age Group").
 */
export function ClassroomPicker({ picker, className = "", classroomLabel = "Classroom" }) {
  const select =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      {picker.centers.length > 1 && (
        <label className="text-xs font-semibold text-[#0b2a5b] dark:text-blue-100">
          Center
          <select className={`${select} mt-1 block w-48`} value={picker.centerId} onChange={(e) => picker.setCenterId(e.target.value)}>
            {picker.centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="text-xs font-semibold text-[#0b2a5b] dark:text-blue-100">
        {classroomLabel}
        <select
          className={`${select} mt-1 block w-48`}
          value={picker.classRoomId}
          onChange={(e) => picker.setClassRoomId(e.target.value)}
          disabled={!picker.classrooms.length}
        >
          {!picker.classrooms.length && <option value="">No classrooms</option>}
          {picker.classrooms.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
