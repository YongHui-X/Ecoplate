/**
 * Date formatting utility functions
 */

/**
 * Format a date/time for conversation display (relative time)
 * Shows: "Just now", "5m ago", "2h ago", "3d ago", or full date
 * @param dateInput - ISO date string or Date object
 * @returns Formatted relative time string
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

/**
 * Format a date/time for message timestamps
 * Shows time for today, "Yesterday" for yesterday, or date for older
 * @param dateInput - ISO date string or Date object
 * @returns Formatted time/date string
 */
export function formatMessageTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeString = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return timeString;
  }
  if (isYesterday) {
    return `Yesterday ${timeString}`;
  }

  return `${date.toLocaleDateString()} ${timeString}`;
}

/**
 * Format time for notification display
 * @param dateInput - ISO date string or Date object
 * @returns Formatted relative time string
 */
export function formatTimeAgo(dateInput: string | Date): string {
  return formatRelativeTime(dateInput);
}
