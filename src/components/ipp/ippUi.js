import { IPP_STATUSES, statusLabel } from "@/lib/ipp";

// Small pieces shared by the IPP pages.

export const NAVY = "text-[#0b2a5b] dark:text-blue-100";

const TONES = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function StatusPill({ status }) {
  const tone = IPP_STATUSES.find((s) => s.value === status)?.tone || "gray";
  return <span className={`inline-block rounded-md px-3 py-1 text-xs font-bold ${TONES[tone]}`}>{statusLabel(status)}</span>;
}

/** mm/dd/yyyy for dates stored at local midnight or as YYYY-MM-DD. */
export function formatDate(value) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** "YYYY-MM-DD" in local time, for date inputs. */
export function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ageLabel(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return "";
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
}

export async function uploadFile(file) {
  const dataBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await fetch("/api/v1/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return { name: file.name, url: data.url };
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
