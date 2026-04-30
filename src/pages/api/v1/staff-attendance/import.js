import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import XLSX from "xlsx";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

const STAFF_ROLE_FILTER = ["ADMIN", "TEACHER", "OTHER_STAFF", "COACH"];
const VALID_STATUSES = new Set(["PRESENT", "LATE", "ABSENT", "HALF_DAY"]);

const COLUMN_ALIASES = {
  name: ["employee", "employee name", "staff", "staff name", "teacher", "teacher name", "name"],
  email: ["email", "employee email", "staff email", "teacher email"],
  date: ["date", "day", "work date", "attendance date"],
  clockIn: ["clock in", "clock-in", "clockin", "sign in", "sign-in", "signin", "check in", "check-in", "checkin", "in time"],
  clockOut: ["clock out", "clock-out", "clockout", "sign out", "sign-out", "signout", "check out", "check-out", "checkout", "out time"],
  status: ["status", "attendance status"],
  lateMinutes: ["late minutes", "minutes late", "late mins", "lateminutes"],
  notes: ["notes", "note", "comments", "comment"],
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseExcelDate(value) {
  if (value instanceof Date) return startOfDay(value);

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return startOfDay(new Date(parsed.y, parsed.m - 1, parsed.d));
  }

  const text = normalizeText(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed);

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const [, monthRaw, dayRaw, yearRaw] = match;
    const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    return startOfDay(new Date(year, month - 1, day));
  }

  return null;
}

function parseTimeValue(baseDate, value) {
  if (!baseDate) return null;
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    const parsed = new Date(baseDate);
    parsed.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), 0);
    return parsed;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const next = new Date(baseDate);
      next.setHours(parsed.H || 0, parsed.M || 0, parsed.S || 0, 0);
      return next;
    }
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const next = new Date(baseDate);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }
  }

  const text = normalizeText(value);
  if (!text) return null;

  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const [, hoursRaw, minutesRaw] = twentyFourHour;
    const next = new Date(baseDate);
    next.setHours(Number(hoursRaw), Number(minutesRaw), 0, 0);
    return next;
  }

  const amPm = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (amPm) {
    const [, hoursRaw, minutesRaw = "0", meridiemRaw] = amPm;
    let hours = Number(hoursRaw) % 12;
    if (meridiemRaw.toUpperCase() === "PM") hours += 12;
    const next = new Date(baseDate);
    next.setHours(hours, Number(minutesRaw), 0, 0);
    return next;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const next = new Date(baseDate);
    next.setHours(parsed.getHours(), parsed.getMinutes(), parsed.getSeconds(), 0);
    return next;
  }

  return null;
}

function parseLateMinutes(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function pickValue(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeKey(key), value]),
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeKey(alias)];
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeStatus(rawStatus, clockIn, clockOut) {
  const normalized = normalizeText(rawStatus).toUpperCase().replace(/\s+/g, "_");
  if (VALID_STATUSES.has(normalized)) return normalized;
  if (normalized === "HALFDAY") return "HALF_DAY";
  if (clockIn || clockOut) return "PRESENT";
  return "";
}

function resolveUser({ email, name, byEmail, byName }) {
  if (email) {
    return byEmail.get(email.toLowerCase()) || null;
  }
  if (!name) return null;
  const matches = byName.get(normalizeText(name).toLowerCase()) || [];
  if (matches.length === 1) return matches[0];
  return matches.length > 1 ? "__AMBIGUOUS__" : null;
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can import staff attendance" });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { centerId, fileBase64, overwriteExisting = true } = req.body || {};
    if (!centerId || !fileBase64) {
      return res.status(400).json({ error: "centerId and fileBase64 are required" });
    }

    const center = await prisma.center.findUnique({
      where: { id: String(centerId) },
      select: { id: true, name: true },
    });
    if (!center) return res.status(404).json({ error: "Center not found" });

    const workbook = XLSX.read(Buffer.from(String(fileBase64), "base64"), {
      type: "buffer",
      cellDates: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: "The uploaded file has no worksheets" });
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: null,
      raw: true,
    });

    if (!rows.length) {
      return res.status(400).json({ error: "The uploaded file has no data rows" });
    }

    const users = await prisma.user.findMany({
      where: {
        centers: { some: { centerId: String(centerId) } },
        OR: [
          { role: { in: STAFF_ROLE_FILTER } },
          { roles: { hasSome: STAFF_ROLE_FILTER } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });

    const byEmail = new Map();
    const byName = new Map();
    for (const user of users) {
      const email = String(user.email || "").trim().toLowerCase();
      const name = normalizeText(user.name).toLowerCase();
      if (email) byEmail.set(email, user);
      if (name) {
        const existing = byName.get(name) || [];
        existing.push(user);
        byName.set(name, existing);
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;

      const email = normalizeText(pickValue(row, COLUMN_ALIASES.email));
      const name = normalizeText(pickValue(row, COLUMN_ALIASES.name));
      const dateValue = pickValue(row, COLUMN_ALIASES.date);
      const clockInValue = pickValue(row, COLUMN_ALIASES.clockIn);
      const clockOutValue = pickValue(row, COLUMN_ALIASES.clockOut);
      const statusValue = pickValue(row, COLUMN_ALIASES.status);
      const notesValue = pickValue(row, COLUMN_ALIASES.notes);

      const rowHasData = [
        email,
        name,
        dateValue,
        clockInValue,
        clockOutValue,
        statusValue,
        notesValue,
      ].some((value) => value !== null && value !== undefined && String(value).trim() !== "");

      if (!rowHasData) {
        skippedCount += 1;
        continue;
      }

      const matchedUser = resolveUser({ email, name, byEmail, byName });
      if (matchedUser === "__AMBIGUOUS__") {
        errors.push(`Row ${rowNumber}: "${name}" matches multiple staff members. Use email in the sheet to disambiguate.`);
        continue;
      }
      if (!matchedUser) {
        errors.push(`Row ${rowNumber}: could not match staff member "${email || name || "unknown"}" in this center.`);
        continue;
      }

      const date = parseExcelDate(dateValue);
      if (!date) {
        errors.push(`Row ${rowNumber}: invalid or missing date.`);
        continue;
      }

      const clockIn = parseTimeValue(date, clockInValue);
      const clockOut = parseTimeValue(date, clockOutValue);
      const status = normalizeStatus(statusValue, clockIn, clockOut);
      if (!status) {
        errors.push(`Row ${rowNumber}: include a valid status or at least one clock-in/clock-out time.`);
        continue;
      }

      const lateMinutes = parseLateMinutes(pickValue(row, COLUMN_ALIASES.lateMinutes));
      const notes = normalizeText(notesValue) || null;

      const existing = await prisma.staffAttendance.findUnique({
        where: {
          userId_date: {
            userId: matchedUser.id,
            date,
          },
        },
        select: { id: true },
      });

      if (existing && !overwriteExisting) {
        skippedCount += 1;
        continue;
      }

      await prisma.staffAttendance.upsert({
        where: {
          userId_date: {
            userId: matchedUser.id,
            date,
          },
        },
        update: {
          clockIn,
          clockOut,
          status,
          lateMinutes,
          notes,
          recordedById: session.user.id,
        },
        create: {
          userId: matchedUser.id,
          centerId: String(centerId),
          date,
          clockIn,
          clockOut,
          status,
          lateMinutes,
          notes,
          recordedById: session.user.id,
        },
      });

      if (existing) updatedCount += 1;
      else createdCount += 1;
    }

    return res.status(200).json({
      worksheet: firstSheetName,
      createdCount,
      updatedCount,
      importedCount: createdCount + updatedCount,
      skippedCount,
      errorCount: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    console.error("staff-attendance/import error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
