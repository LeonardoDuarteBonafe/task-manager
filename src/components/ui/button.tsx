"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success" | "softDanger" | "contrast";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold tracking-[0.02em] shadow-[0_8px_24px_rgba(20,16,12,0.06)] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "border-transparent bg-[var(--surface-accent)] text-white hover:-translate-y-0.5 hover:bg-[var(--surface-accent-strong)]",
        variant === "secondary" &&
          "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)]",
        variant === "danger" && "border-transparent bg-rose-600 text-white hover:-translate-y-0.5 hover:bg-rose-500",
        variant === "success" && "border-transparent bg-emerald-600 text-white hover:-translate-y-0.5 hover:bg-emerald-500",
        variant === "softDanger" &&
          "border-transparent bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25",
        variant === "contrast" &&
          "border-[var(--border-strong)] bg-[var(--surface-contrast)] text-[var(--background)] hover:-translate-y-0.5 hover:opacity-95",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--foreground)] shadow-none hover:-translate-y-0.5 hover:bg-[var(--surface-card)]",
        className,
      )}
      {...props}
    />
  );
}
