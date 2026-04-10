import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({
  interval: 60_000,
  limit: 10,
  getKey: (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip =
      (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
      req.socket?.remoteAddress ||
      "unknown";
    const email =
      typeof req.body?.email === "string" && req.body.email.trim()
        ? req.body.email.trim().toLowerCase()
        : "";
    return email ? `${ip}:${email}` : ip;
  },
});

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { isLimited } = limiter.check(req);
    if (isLimited) {
      return res
        .status(429)
        .json({ error: "Too many login attempts. Please try again later." });
    }
  }

  return NextAuth(req, res, authOptions);
}
