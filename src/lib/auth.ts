// NextAuth configuration — Google OAuth
// Used by /api/auth/[...nextauth]/route.ts and the middleware

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Expose email + name in the session token so the UI can show who is logged in
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
  // Uncomment the block below to restrict access to specific Gmail addresses:
  // callbacks: {
  //   async signIn({ user }) {
  //     const allowed = ["surajcs@gmail.com", "colleague@gmail.com"];
  //     return allowed.includes(user.email ?? "");
  //   },
  // },
};

export default NextAuth(authOptions);
