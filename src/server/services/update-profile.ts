import { prisma } from "@/lib/prisma";
import { DomainError } from "./task-domain/errors";

export async function updateProfile(input: { userId: string; name: string }) {
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new DomainError("Name is required.");
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });

  if (!user) {
    throw new DomainError("User not found.");
  }

  return prisma.user.update({
    where: { id: input.userId },
    data: { name: trimmedName },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
