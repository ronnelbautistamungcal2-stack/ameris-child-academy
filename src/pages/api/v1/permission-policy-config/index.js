import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  DEFAULT_PERMISSION_POLICIES,
  PERMISSION_TYPE_VALUES,
} from "@/lib/permissionPolicies";

function sanitizeSections(input) {
  if (!Array.isArray(input)) return [];
  return input.map((s) => String(s || "").trim()).filter(Boolean);
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (!["ADMIN", "TEACHER", "PARENT", "COACH"].includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") return handleGet(req, res);
    if (req.method === "PUT") {
      if (session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can update permission policies" });
      }
      return handlePut(req, res, session);
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).end();
  } catch (e) {
    console.error("permission-policy-config error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleGet(req, res) {
  const centerId = String(req.query.centerId || "").trim() || null;

  const overrides = await prisma.permissionPolicyConfig.findMany({
    where: centerId ? { OR: [{ centerId }, { centerId: null }] } : { centerId: null },
    include: { policyDocument: true },
  });

  const overrideByType = new Map();
  for (const override of overrides) {
    const existing = overrideByType.get(override.permissionType);
    if (!existing || (existing.centerId === null && override.centerId)) {
      overrideByType.set(override.permissionType, override);
    }
  }

  const result = DEFAULT_PERMISSION_POLICIES.map((def) => {
    const override = overrideByType.get(def.value) || null;
    return {
      value: def.value,
      label: override?.label || def.label,
      description: override?.description || def.description,
      policySummary: override?.policySummary || def.policySummary,
      policySections:
        override?.policySections?.length ? override.policySections : def.policySections,
      policyDocument: override?.policyDocument
        ? { id: override.policyDocument.id, title: override.policyDocument.title, url: override.policyDocument.url }
        : null,
      isCustomized: Boolean(override),
    };
  });

  return res.status(200).json(result);
}

async function handlePut(req, res, session) {
  const {
    permissionType,
    centerId,
    label,
    description,
    policySummary,
    policySections,
    policyDocumentId,
  } = req.body || {};

  if (!PERMISSION_TYPE_VALUES.includes(permissionType)) {
    return res.status(400).json({ error: "Invalid permission type" });
  }

  const normalizedCenterId = centerId || null;

  const data = {
    label: label ? String(label).trim() : null,
    description: description ? String(description).trim() : null,
    policySummary: policySummary ? String(policySummary).trim() : null,
    policySections: sanitizeSections(policySections),
    policyDocumentId: policyDocumentId || null,
    updatedById: session.user.id,
  };

  const config = await prisma.permissionPolicyConfig.upsert({
    where: {
      centerId_permissionType: {
        centerId: normalizedCenterId,
        permissionType,
      },
    },
    create: { centerId: normalizedCenterId, permissionType, ...data },
    update: data,
    include: { policyDocument: true },
  });

  return res.status(200).json(config);
}
