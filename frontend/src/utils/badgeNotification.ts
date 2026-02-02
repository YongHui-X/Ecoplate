/**
 * Show toast notifications for newly earned badges.
 * Call this after any API response that may include newBadges.
 */
export function showBadgeToasts(
  response: { newBadges?: Array<{ name: string; pointsAwarded: number }> },
  addToast: (msg: string, type?: "success" | "error" | "info") => void
) {
  response.newBadges?.forEach((b) =>
    addToast(`Badge Earned: ${b.name}! +${b.pointsAwarded} pts`, "success")
  );
}
