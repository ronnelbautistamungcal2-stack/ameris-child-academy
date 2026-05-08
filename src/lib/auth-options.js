import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { normalizeRoles, primaryRoleFromRoles } from "@/lib/roles";

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
            role: primaryRoleFromRoles(user.roles, user.role),
            roles: normalizeRoles(user.roles, user.role),
            pictureUrl: user.pictureUrl,
            mustChangePassword: Boolean(user.mustChangePassword),
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
        token.roles = normalizeRoles(user.roles, user.role);
        token.role = token.roles.includes(user.role) ? user.role : token.roles[0];
        token.id = user.id;
        token.email = user.email;
        token.pictureUrl = user.pictureUrl || null;
        token.mustChangePassword = Boolean(user.mustChangePassword);
        token.pictureUrlFetchedAt = Date.now();
        return token;
      }

      if (trigger === "update" && session?.user) {
        if ("pictureUrl" in session.user) token.pictureUrl = session.user.pictureUrl || null;
        if ("name" in session.user) token.name = session.user.name || token.name;
        if ("email" in session.user) token.email = session.user.email || token.email;
        if ("mustChangePassword" in session.user) {
          token.mustChangePassword = Boolean(session.user.mustChangePassword);
        }
        if ("role" in session.user) {
          const requestedRole = String(session.user.role || "").toUpperCase();
          const allowedRoles = normalizeRoles(token.roles, token.role);
          if (allowedRoles.includes(requestedRole)) token.role = requestedRole;
        }
        token.pictureUrlFetchedAt = Date.now();
        return token;
      }

      if (trigger === "update" && session && !session.user) {
        // Some callers may send top-level fields.
        if ("pictureUrl" in session) token.pictureUrl = session.pictureUrl || null;
        if ("name" in session) token.name = session.name || token.name;
        if ("email" in session) token.email = session.email || token.email;
        if ("mustChangePassword" in session) {
          token.mustChangePassword = Boolean(session.mustChangePassword);
        }
        if ("role" in session) {
          const requestedRole = String(session.role || "").toUpperCase();
          const allowedRoles = normalizeRoles(token.roles, token.role);
          if (allowedRoles.includes(requestedRole)) token.role = requestedRole;
        }
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
        select: {
          role: true,
          roles: true,
          pictureUrl: true,
          name: true,
          email: true,
          mustChangePassword: true,
        },
      });
      if (!dbUser) return token;

      token.roles = normalizeRoles(dbUser.roles, dbUser.role);
      token.role = token.roles.includes(token.role) ? token.role : token.roles[0];
      token.pictureUrl = dbUser.pictureUrl || null;
      token.name = dbUser.name || token.name;
      token.email = dbUser.email || token.email;
      token.mustChangePassword = Boolean(dbUser.mustChangePassword);
      token.pictureUrlFetchedAt = Date.now();

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.roles = normalizeRoles(token.roles, token.role);
        session.user.pictureUrl = token.pictureUrl || null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
};
