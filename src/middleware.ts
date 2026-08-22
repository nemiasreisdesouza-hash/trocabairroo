import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "trocabairro-secret-key-change-in-production"
);

const protectedRoutes = [
  "/dashboard",
  "/perfil/editar",
  "/anuncio/criar",
  "/anuncio/editar",
  "/interesses",
  "/notificacoes",
  "/admin",
];

const adminRoutes = ["/admin"];

const authRoutes = ["/login", "/cadastro", "/recuperar-senha"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("session_token")?.value;

  // Rate limiting (basic - check X-Forwarded-For)
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rateLimitKey = `rate_${ip}`;

  // Check if route is protected
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtected || isAdminRoute) {
    if (!token) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userId = payload.userId as string;

      if (!userId) {
        const url = new URL("/login", request.url);
        return NextResponse.redirect(url);
      }

      if (isAdminRoute) {
        // Admin check will be done in the page component for now
        // since middleware can't easily query DB
      }
    } catch {
      const url = new URL("/login", request.url);
      return NextResponse.redirect(url);
    }
  }

  if (isAuthRoute && token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch {
      // Invalid token, allow auth routes
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|icons|manifest.json|sw.js).*)",
  ],
};
