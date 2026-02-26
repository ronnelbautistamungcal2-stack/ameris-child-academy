import { getSession } from "@/lib/auth";
import xlsx from "xlsx";

export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { dataBase64 } = req.body || {};
  if (!dataBase64 || typeof dataBase64 !== "string") {
    return res.status(400).json({ error: "dataBase64 is required" });
  }

  try {
    const buffer = Buffer.from(dataBase64, "base64");
    const wb = xlsx.read(buffer, { cellDates: true });

    const sheets = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      const raw = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      if (!raw.length) return { name, headers: [], rows: [] };

      // Find header row (first row with 3+ non-empty cells)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const nonEmpty = (raw[i] || []).filter((c) => String(c).trim() !== "").length;
        if (nonEmpty >= 3) {
          headerIdx = i;
          break;
        }
      }

      const headers = (raw[headerIdx] || []).map((h) => String(h).trim());
      const dataRows = raw.slice(headerIdx + 1, headerIdx + 501).map((row) =>
        headers.map((_, ci) => String(row[ci] ?? "").trim())
      );

      return { name, headers, rows: dataRows };
    });

    return res.status(200).json({ sheets });
  } catch (err) {
    console.error("Excel parse error:", err);
    return res.status(400).json({ error: "Failed to parse Excel file" });
  }
}
