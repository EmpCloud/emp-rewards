import i18n from "@/lib/i18n";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function activeLocale(): string {
  return i18n.resolvedLanguage || i18n.language || "en";
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(activeLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
