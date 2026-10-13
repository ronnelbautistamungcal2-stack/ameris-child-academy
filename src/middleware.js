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
  // Front-desk kiosk: used with no one signed in; its APIs require an enrolled
  // device instead, and /kiosk/setup checks for an admin itself.
  "/kiosk",
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

  if (token.disabled) {
    // Sign the disabled user out: drop the session cookie on the way to /login.
    const response = NextResponse.redirect(new URL("/login?error=AccountDisabled", request.url));
    response.cookies.delete("next-auth.session-token");
    response.cookies.delete("__Secure-next-auth.session-token");
    return response;
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
