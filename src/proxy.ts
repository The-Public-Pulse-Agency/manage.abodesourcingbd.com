import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  // /api/cron is guarded by its own CRON_SECRET bearer check — exempt it from the
  // session redirect so a session-less scheduler reaches the handler.
  // PWA assets (manifest + generated monogram icons) must load on the public login screen.
  const isPwaAsset =
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/icon-192" ||
    pathname === "/icon-512";
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    isPwaAsset;
  if (!isLoggedIn && !isPublic) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
