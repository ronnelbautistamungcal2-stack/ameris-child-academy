import prisma from "@/lib/prisma";

/**
 * GET /api/v1/public/resources
 * Additional Resources an admin marked "Add to Home Page", for the public
 * Resources page (no sign-in). Only the fields the public page shows.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const docs = await prisma.policyDocument.findMany({
    where: { category: "RESOURCE", active: true, showOnHomePage: true },
    select: { id: true, title: true, description: true, url: true, websiteUrl: true, logoUrl: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json(
    docs.map((d) => ({ id: d.id, title: d.title, description: d.description || "", href: d.websiteUrl || d.url, logoUrl: d.logoUrl || null })),
  );
}
