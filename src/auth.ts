import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { findUserByUsername } from "@/domain/users";
import { verifyPassword } from "@/server/passwords";

/**
 * Username and password sign-in with Auth.js. The password is checked against a hash kept
 * in an environment variable; the session is an encrypted cookie that only holds the
 * user's id, never the password.
 */
export const { handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize(credentials) {
        const user = findUserByUsername(credentials.username);
        const password = credentials.password;
        if (!user || typeof password !== "string") return null;
        if (!verifyPassword(password, process.env[user.passwordHashEnv])) return null;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
  },
});
