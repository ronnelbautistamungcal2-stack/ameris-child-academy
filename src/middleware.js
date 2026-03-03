import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

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

const ROLE_ROUTES = {
  ADMIN: ["/admin"],
  TEACHER: ["/teacher"],
  PARENT: ["/parent"],
  COACH: ["/coach"],
  SUBSCRIBER: ["/subscriber"],
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

  const userRole = token.role;
  for (const [role, prefixes] of Object.entries(ROLE_ROUTES)) {
    for (const prefix of prefixes) {
      if (
        pathname.startsWith(prefix) &&
        userRole !== role &&
        userRole !== "ADMIN"
      ) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)",
  ],
};
