import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

type RegisterUserInput = {
  email: string;
  password: string;
  confirmPassword: string;
  name?: string | null;
};

export async function registerUser(input: RegisterUserInput) {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!email) {
    throw new DomainError("Email is required.");
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    throw new DomainError("Password must have at least 8 characters with letters and numbers.");
  }

  if (password !== input.confirmPassword.trim()) {
    throw new DomainError("Passwords do not match.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new DomainError("User already exists.");
  }

  const passwordHash = await hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash,
    },
  });
}
