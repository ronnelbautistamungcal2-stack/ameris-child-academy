import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  canUseMessageAudiences,
  MESSAGE_AUDIENCE_OPTIONS,
  resolveMessageAudienceUsers,
} from "@/lib/messageAudiences";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const user = session.user;
  if (!canUseMessageAudiences(user)) {
    return res.status(200).json([]);
  }

  const centerId = String(req.query.centerId || "").trim();
  const threadType = String(req.query.threadType || "").trim();

  try {
    const options = await Promise.all(
      MESSAGE_AUDIENCE_OPTIONS.map(async (option) => {
        const recipients = await resolveMessageAudienceUsers({
          prismaClient: prisma,
          user,
          audienceKey: option.key,
          centerId,
          threadType,
        });

        return {
          key: option.key,
          label: option.label,
          description: option.description,
          count: recipients.length,
        };
      }),
    );

    return res.status(200).json(options);
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message || "Failed to load messaging audiences",
    });
  }
}
