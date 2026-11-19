import { publicSiteInfo } from "@/lib/globalSettings";

/**
 * GET /api/v1/solutions/site-info  (public, no sign-in)
 * The phone and email the Ameris Solutions website shows, from Global admin >
 * Settings > General (client 2026-11-19).
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  try {
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json(await publicSiteInfo());
  } catch (e) {
    console.error("site info error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
