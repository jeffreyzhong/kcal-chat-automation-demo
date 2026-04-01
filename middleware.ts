import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    // Protect page routes only — exclude all API routes, auth pages, static files
    "/((?!api|auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
