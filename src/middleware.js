import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { STAFF_PORTAL_ROLES } from "@/lib/roles";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/offline",
  "/about",
  "/programs",
  "/careers",
  "/contact",
  "/resources",
  "/external-clients",
  "/calendar",
]);

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/_next",
  "/icons",
  "/uploads",
  "/home-video.mp4",
  "/manifest.json",
  "/sw.js",
];

// Route prefix -> roles allowed there. Admins may visit every portal.
const ROUTE_ROLES = {
  "/admin": ["ADMIN"],
  "/teacher": ["TEACHER"],
  "/staff": STAFF_PORTAL_ROLES,
  "/parent": ["PARENT"],
  "/coach": ["COACH"],
  "/subscriber": ["SUBSCRIBER"],
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token.mustChangePassword && pathname !== "/settings") {
    const settingsUrl = new URL("/settings", request.url);
    settingsUrl.searchParams.set("forcePasswordChange", "1");
    return NextResponse.redirect(settingsUrl);
  }

  const userRole = token.role;
  for (const [prefix, roles] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(prefix) && !roles.includes(userRole) && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)",
  ],
};
