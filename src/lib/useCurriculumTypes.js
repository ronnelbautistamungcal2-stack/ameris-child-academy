import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { CURRICULUM_TYPES } from "@/lib/curriculumTypes";

// The curriculum types from Curriculum > Categories > Types (client sheet
// 10-29 (8), rows 8-10), loaded once per page and shared by every picker.
// Until they load, the starting list is shown.

let cache = null;
let pending = null;
const listeners = new Set();

/** Loads the list again (after a type is added, renamed or removed) and updates every picker. */
export function refreshCurriculumTypes() {
  pending = apiJson("/api/v1/curriculum-types")
    .then((data) => {
      cache = data;
      listeners.forEach((fn) => fn(data));
      return data;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** { types: [{ value, label }], canEdit, loaded } */
export function useCurriculumTypes() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    listeners.add(setData);
    if (cache) setData(cache);
    else if (!pending) refreshCurriculumTypes();
    return () => listeners.delete(setData);
  }, []);
  return { types: data?.types || CURRICULUM_TYPES, canEdit: Boolean(data?.canEdit), loaded: Boolean(data) };
}
