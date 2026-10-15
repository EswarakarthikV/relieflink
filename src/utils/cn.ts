import { clsx, type ClassValue } from 'clsx'

/**
 * Utility for merging Tailwind class names conditionally.
 * Wraps clsx directly — add tailwind-merge here if class conflicts arise.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
