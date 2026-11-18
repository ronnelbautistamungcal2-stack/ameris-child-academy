import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { accountSummaryForUser } from "@/lib/subscriberAccounts";
import { accountUsesAmerisCurriculum, curriculumSourceCenter } from "@/lib/curriculumSource";

/**
 * GET /api/v1/account -> { account, addOns, usage }
 * The signed-in person's subscriber account and the add-ons it has. addOns is
 * null when they have no account, which means nothing is locked. Admins also
 * get usage (centers and children) for the Subscription page.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const summary = await accountSummaryForUser(session.user.id);
  const { addOns } = summary;
  // amerisCurriculum: the account follows the Ameris Solutions curriculum, so
  // it gets the Lesson Calendar but not the banks or planner (step E).
  // curriculumOwner: the account holds the Ameris curriculum center (Ameris
  // Academy); its banks and planner are edited under Global admin > Lesson
  // Bank & SOP, so the Admin portal keeps only the Lesson Calendar (client
  // sheet 10-29 (9), rows 4/5).
  const source = summary.account ? await curriculumSourceCenter() : null;
  const account = summary.account
    ? {
        ...summary.account,
        amerisCurriculum: await accountUsesAmerisCurriculum(summary.account.id, undefined, source),
        curriculumOwner: Boolean(source && source.subscriberAccountId === summary.account.id),
      }
    : null;
  let usage = null;
  if (account && session.user.role === "ADMIN") {
    // The child limit is per center, so usage lists each center's children.
    const centers = await prisma.center.findMany({
      where: { subscriberAccountId: account.id },
      select: { id: true, name: true, _count: { select: { children: true } } },
      orderBy: { name: "asc" },
    });
    usage = {
      centers: centers.length,
      children: centers.reduce((sum, c) => sum + c._count.children, 0),
      childrenByCenter: centers.map((c) => ({ id: c.id, name: c.name, children: c._count.children })),
    };
  }
  return res.status(200).json({ account, addOns, usage });
}
