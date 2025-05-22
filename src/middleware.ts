import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  // Get token using NextAuth JWT
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Check if token exists and is not expired
  const now = Math.floor(Date.now() / 1000);

  // Properly check the expiresAt field type before converting to Date
  let tokenExpiry = 0;
  if (token?.expiresAt) {
    if (
      typeof token.expiresAt === "string" ||
      token.expiresAt instanceof Date ||
      typeof token.expiresAt === "number"
    ) {
      tokenExpiry = new Date(token.expiresAt).getTime() / 1000;
    } else {
      console.log(
        "[Middleware] Invalid expiresAt format:",
        typeof token.expiresAt
      );
    }
  }

  const isTokenValid = !!token && tokenExpiry > now;

  console.log(`[Middleware] Path: ${request.nextUrl.pathname}`);
  console.log(`[Middleware] Token exists: ${!!token}, Valid: ${isTokenValid}`);

  const isAuthPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/register";
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/chat");

  // If user is not authenticated and trying to access protected routes
  if (!isTokenValid && isProtectedRoute) {
    console.log("[Middleware] Redirecting unauthenticated user to login page");
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and trying to access auth pages
  if (isTokenValid && isAuthPage) {
    console.log("[Middleware] Redirecting authenticated user to chat page");
    const chatUrl = new URL("/chat/messages", request.url);
    return NextResponse.redirect(chatUrl);
  }

  // Allow the request to proceed
  console.log("[Middleware] Allowing request to proceed");
  return NextResponse.next();
}

// Only run middleware on these paths
export const config = {
  matcher: ["/", "/register", "/chat/:path*"],
};
