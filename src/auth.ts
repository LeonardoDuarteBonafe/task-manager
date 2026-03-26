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
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: hasDatabaseUrl ? PrismaAdapter(prisma) : undefined,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
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

        if (!hasDatabaseUrl) {
          return null;
        }

        try {
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
        } catch (error) {
          console.error("Falha ao validar credenciais com o banco.", error);
          return null;
        }
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) token.sub = user.id;
      if (user?.name !== undefined) token.name = user.name;
      if (user?.image !== undefined) token.picture = user.image;
      if (user?.email === FORCE_LOGIN_EMAIL || (user as { isForced?: boolean } | undefined)?.isForced) {
        token.isForced = true;
      }
      if (trigger === "update") {
        if (typeof session?.name === "string") {
          token.name = session.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isForced = token.isForced === true;
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
        session.user.image = typeof token.picture === "string" ? token.picture : session.user.image;
      }
      return session;
    },
  },
});
