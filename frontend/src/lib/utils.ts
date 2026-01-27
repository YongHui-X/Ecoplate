import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility functions for food expiry tracking
export function getDaysUntilExpiry(expiryDate: string | Date | null): number {
  if (!expiryDate) return 999; // No expiry date means it doesn't expire
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getExpiryStatus(expiryDate: string | Date | null): 'expired' | 'expiring-soon' | 'fresh' {
  if (!expiryDate) return 'fresh'; // No expiry date means it's fresh
  const days = getDaysUntilExpiry(expiryDate);

  if (days < 0) return 'expired';
  if (days <= 3) return 'expiring-soon';
  return 'fresh';
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}
