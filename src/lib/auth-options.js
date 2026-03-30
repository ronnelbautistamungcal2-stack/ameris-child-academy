import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials) return null;
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user || !user.password) return null;
          const isValid = await bcrypt.compare(
            credentials.password,
            user.password,
          );
          if (!isValid) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            pictureUrl: user.pictureUrl,
          };
        } catch (error) {
          console.error("NextAuth authorize error:", error);
          throw new Error("AUTH_SERVICE_UNAVAILABLE");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.pictureUrl = user.pictureUrl || null;
        token.pictureUrlFetchedAt = Date.now();
        return token;
      }

      if (trigger === "update" && session?.user) {
        if ("pictureUrl" in session.user) token.pictureUrl = session.user.pictureUrl || null;
        if ("name" in session.user) token.name = session.user.name || token.name;
        token.pictureUrlFetchedAt = Date.now();
        return token;
      }

      if (trigger === "update" && session && !session.user) {
        // Some callers may send top-level fields.
        if ("pictureUrl" in session) token.pictureUrl = session.pictureUrl || null;
        if ("name" in session) token.name = session.name || token.name;
        token.pictureUrlFetchedAt = Date.now();
        return token;
      }

      // Keep pictureUrl reasonably fresh so avatar updates without forcing a re-login.
      const userId = token?.id;
      if (!userId) return token;
      const fetchedAt = Number(token.pictureUrlFetchedAt || 0);
      const ageMs = Date.now() - fetchedAt;
      if (ageMs < 5 * 60 * 1000) return token; // 5 minutes

      const dbUser = await prisma.user.findUnique({
        where: { id: String(userId) },
        select: { role: true, pictureUrl: true, name: true, email: true },
      });
      if (!dbUser) return token;

      token.role = dbUser.role;
      token.pictureUrl = dbUser.pictureUrl || null;
      token.name = dbUser.name || token.name;
      token.email = dbUser.email || token.email;
      token.pictureUrlFetchedAt = Date.now();

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.pictureUrl = token.pictureUrl || null;
      }
      return session;
    },
  },
  secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
};
