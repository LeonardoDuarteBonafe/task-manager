import { NextResponse } from "next/server";
import { auth } from "@/auth";

const protectedPrefixes = ["/dashboard", "/tasks", "/recorrencias", "/configuracoes", "/meu-perfil"];
const guestOnlyRoutes = ["/", "/login", "/cadastro", "/recuperar-senha"];

export default auth((request) => {
  const { nextUrl, auth: session } = request;
  const { pathname, search } = nextUrl;
  const isAuthenticated = Boolean(session?.user);
  const isProtectedRoute = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isGuestOnlyRoute = guestOnlyRoutes.includes(pathname);

  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", nextUrl);
    const callbackUrl = `${pathname}${search}`;
    if (callbackUrl !== "/login") {
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isGuestOnlyRoute) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)"],
};
