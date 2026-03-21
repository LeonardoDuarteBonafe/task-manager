import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const FORCE_LOGIN_EMAIL = "force@taskmanager.local";
const FORCE_LOGIN_PASSWORD = "Force@123456";
const FORCE_LOGIN_USER_ID = "force-session-user";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        if (
          parsed.data.email.toLowerCase() === FORCE_LOGIN_EMAIL &&
          parsed.data.password === FORCE_LOGIN_PASSWORD
        ) {
          return {
            id: FORCE_LOGIN_USER_ID,
            email: FORCE_LOGIN_EMAIL,
            name: "Acesso Forcado",
            image: null,
          };
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;

        const isValidPassword = await compare(parsed.data.password, user.passwordHash);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (user?.email === FORCE_LOGIN_EMAIL || (user as { isForced?: boolean } | undefined)?.isForced) {
        token.isForced = true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isForced = token.isForced === true;
      }
      return session;
    },
  },
});
