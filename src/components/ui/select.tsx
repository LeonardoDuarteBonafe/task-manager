import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-[1.1rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--border-strong)] focus:ring-4 focus:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}
