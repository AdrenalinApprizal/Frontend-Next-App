import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  // Get token using NextAuth JWT
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isAuthPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/register";
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/chat");

  // If user is not authenticated and trying to access protected routes
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and trying to access auth pages
  if (isAuthenticated && isAuthPage) {
    const chatUrl = new URL("/chat/messages", request.url);
    return NextResponse.redirect(chatUrl);
  }

  return NextResponse.next();
}

// Only run middleware on these paths
export const config = {
  matcher: ["/", "/register", "/chat/:path*"],
};
