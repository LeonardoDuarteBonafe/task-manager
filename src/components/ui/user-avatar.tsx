"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name?: string | null;
  image?: string | null;
  className?: string;
};

function buildInitials(name?: string | null) {
  if (!name) return "U";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export function UserAvatar({ name, image, className }: UserAvatarProps) {
  const initials = buildInitials(name);

  if (image) {
    return (
      <Image
        alt={name ? `Avatar de ${name}` : "Avatar do usuario"}
        className={cn("h-10 w-10 rounded-full border border-slate-200 object-cover dark:border-slate-800", className)}
        height={40}
        src={image}
        width={40}
      />
    );
  }

  return (
    <div
      aria-label={name ? `Avatar de ${name}` : "Avatar do usuario"}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
        className,
      )}
    >
      {initials}
    </div>
  );
}
