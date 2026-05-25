// Route protection — requires a valid Google session for all pages
// API routes are left unguarded so the MRAL runtime can self-call without tokens.
// Static assets and the auth flow are always public.

export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect everything except:
     *  - /api/auth/**        (NextAuth callbacks)
     *  - /login              (sign-in page)
     *  - /_next/**           (Next.js static files)
     *  - /favicon.ico
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
