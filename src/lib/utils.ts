import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function formatLpa(value: number | undefined): string {
  if (value == null) return "—";
  return `₹${value} L`;
}

export function formatNotice(days: number): string {
  if (days <= 0) return "Immediate";
  if (days === 30) return "30 days";
  if (days === 60) return "60 days";
  if (days === 90) return "90 days";
  return `${days} days`;
}

export function yearRange(start: number, end: number | null): string {
  return end ? `${start}–${end}` : `${start}–now`;
}
