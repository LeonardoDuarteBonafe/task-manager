import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

export async function getProfile(input: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new DomainError("User not found.");
  }

  return user;
}
