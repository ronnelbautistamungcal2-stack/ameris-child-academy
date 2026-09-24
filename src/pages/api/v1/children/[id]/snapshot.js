import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  isChildLinkedToParent,
  linkedParentAccountsInclude,
} from "@/lib/child-parent-links";
import {
  buildChildSnapshotUpdate,
  childSnapshotSelect,
  pickChildSnapshot,
} from "@/lib/childSnapshot";

const STAFF_ROLES = ["ADMIN", "TEACHER", "COACH"];

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end();
  }

  const child = await prisma.child.findUnique({
    where: { id },
    include: linkedParentAccountsInclude,
  });
  if (!child) return res.status(404).json({ error: "Child not found" });

  const isStaff = STAFF_ROLES.includes(session.user.role);
  const isLinkedParent =
    session.user.role === "PARENT" &&
    isChildLinkedToParent(child, session.user.id);
  if (!isStaff && !isLinkedParent) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = buildChildSnapshotUpdate(req.body);
  if (error) return res.status(400).json({ error });

  const updated = await prisma.child.update({
    where: { id },
    data,
    select: { id: true, ...childSnapshotSelect },
  });

  return res.status(200).json({ id: updated.id, ...pickChildSnapshot(updated) });
}
