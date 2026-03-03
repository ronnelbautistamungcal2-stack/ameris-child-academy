import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

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
