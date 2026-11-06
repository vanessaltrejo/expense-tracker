import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowedEmail } from "@/server/allowedEmail";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * Google sign-in with Auth.js. The Google tokens live only inside the encrypted session
 * cookie and are read on the server; the browser never sees them.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${SHEETS_SCOPE}`,
          // "offline" + "consent" make Google return a refresh token, so access renews
          // by itself instead of asking to reconnect every hour.
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ profile }) {
      return isAllowedEmail(profile?.email);
    },
    jwt({ token, account }) {
      if (account) {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleExpiresAt = account.expires_at;
      }
      return token;
    },
  },
});
