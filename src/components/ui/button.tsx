"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-slate-900 text-white hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500",
        variant === "secondary" &&
          "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
        variant === "ghost" && "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
        className,
      )}
      {...props}
    />
  );
}
