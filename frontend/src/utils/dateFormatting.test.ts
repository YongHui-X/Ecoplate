import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime, formatMessageTime, formatTimeAgo } from "./dateFormatting";

describe("dateFormatting utils", () => {
  beforeEach(() => {
    // Mock current time to Feb 12, 2026, 10:30:00 AM
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-12T10:30:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatRelativeTime", () => {
    it("returns 'Just now' for times less than 1 minute ago", () => {
      const now = new Date("2026-02-12T10:30:00");
      expect(formatRelativeTime(now)).toBe("Just now");

      const thirtySecsAgo = new Date("2026-02-12T10:29:30");
      expect(formatRelativeTime(thirtySecsAgo)).toBe("Just now");
    });

    it("returns minutes for times less than 1 hour ago", () => {
      const fiveMinsAgo = new Date("2026-02-12T10:25:00");
      expect(formatRelativeTime(fiveMinsAgo)).toBe("5m ago");

      const thirtyMinsAgo = new Date("2026-02-12T10:00:00");
      expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");

      const fiftyNineMinsAgo = new Date("2026-02-12T09:31:00");
      expect(formatRelativeTime(fiftyNineMinsAgo)).toBe("59m ago");
    });

    it("returns hours for times less than 24 hours ago", () => {
      const twoHoursAgo = new Date("2026-02-12T08:30:00");
      expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");

      const twelveHoursAgo = new Date("2026-02-11T22:30:00");
      expect(formatRelativeTime(twelveHoursAgo)).toBe("12h ago");

      const twentyThreeHoursAgo = new Date("2026-02-11T11:30:00");
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe("23h ago");
    });

    it("returns days for times less than 7 days ago", () => {
      const oneDayAgo = new Date("2026-02-11T10:30:00");
      expect(formatRelativeTime(oneDayAgo)).toBe("1d ago");

      const threeDaysAgo = new Date("2026-02-09T10:30:00");
      expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");

      const sixDaysAgo = new Date("2026-02-06T10:30:00");
      expect(formatRelativeTime(sixDaysAgo)).toBe("6d ago");
    });

    it("returns formatted date for times 7+ days ago", () => {
      const sevenDaysAgo = new Date("2026-02-05T10:30:00");
      const result = formatRelativeTime(sevenDaysAgo);
      // toLocaleDateString format varies by locale, just check it's not relative
      expect(result).not.toContain("ago");
      expect(result).not.toBe("Just now");
    });

    it("returns formatted date for very old dates", () => {
      const oldDate = new Date("2020-01-01T10:30:00");
      const result = formatRelativeTime(oldDate);
      expect(result).not.toContain("ago");
    });

    it("handles ISO date string input", () => {
      const fiveMinsAgo = "2026-02-12T10:25:00";
      expect(formatRelativeTime(fiveMinsAgo)).toBe("5m ago");
    });

    it("handles Date object input", () => {
      const fiveMinsAgo = new Date("2026-02-12T10:25:00");
      expect(formatRelativeTime(fiveMinsAgo)).toBe("5m ago");
    });
  });

  describe("formatMessageTime", () => {
    it("returns 'Today' with time for today's messages", () => {
      const todayMorning = new Date("2026-02-12T08:15:00");
      const result = formatMessageTime(todayMorning);
      expect(result).toMatch(/^Today, /);
      expect(result).toMatch(/8:15/);
    });

    it("returns 'Yesterday' with time for yesterday's messages", () => {
      const yesterday = new Date("2026-02-11T14:30:00");
      const result = formatMessageTime(yesterday);
      expect(result).toMatch(/^Yesterday, /);
      expect(result).toMatch(/2:30/);
    });

    it("returns formatted date for older messages", () => {
      const oldDate = new Date("2026-02-05T09:00:00");
      const result = formatMessageTime(oldDate);
      expect(result).not.toContain("Today");
      expect(result).not.toContain("Yesterday");
      // Should contain month and day
      expect(result).toMatch(/Feb.*5/);
    });

    it("handles ISO date string input", () => {
      const todayStr = "2026-02-12T08:15:00";
      const result = formatMessageTime(todayStr);
      expect(result).toMatch(/^Today, /);
    });

    it("handles Date object input", () => {
      const todayDate = new Date("2026-02-12T08:15:00");
      const result = formatMessageTime(todayDate);
      expect(result).toMatch(/^Today, /);
    });

    it("includes time in all formats", () => {
      const today = new Date("2026-02-12T08:15:00");
      const yesterday = new Date("2026-02-11T14:30:00");
      const older = new Date("2026-02-01T09:00:00");

      // All should include time portion
      expect(formatMessageTime(today)).toMatch(/\d{1,2}:\d{2}/);
      expect(formatMessageTime(yesterday)).toMatch(/\d{1,2}:\d{2}/);
      expect(formatMessageTime(older)).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe("formatTimeAgo", () => {
    it("is an alias for formatRelativeTime", () => {
      const fiveMinsAgo = new Date("2026-02-12T10:25:00");
      expect(formatTimeAgo(fiveMinsAgo)).toBe(formatRelativeTime(fiveMinsAgo));

      const twoHoursAgo = new Date("2026-02-12T08:30:00");
      expect(formatTimeAgo(twoHoursAgo)).toBe(formatRelativeTime(twoHoursAgo));

      const threeDaysAgo = new Date("2026-02-09T10:30:00");
      expect(formatTimeAgo(threeDaysAgo)).toBe(formatRelativeTime(threeDaysAgo));
    });

    it("handles string input", () => {
      const result = formatTimeAgo("2026-02-12T10:25:00");
      expect(result).toBe("5m ago");
    });

    it("handles Date input", () => {
      const result = formatTimeAgo(new Date("2026-02-12T10:25:00"));
      expect(result).toBe("5m ago");
    });
  });
});
