import type { User } from "../types";

const KEYS = {
  token: "ecolocker_token",
  user: "ecolocker_user",
  pendingListing: "ecolocker_pending_listing",
} as const;

export const storage = {
  getToken(): string | null {
    return sessionStorage.getItem(KEYS.token);
  },
  setToken(token: string): void {
    sessionStorage.setItem(KEYS.token, token);
  },
  removeToken(): void {
    sessionStorage.removeItem(KEYS.token);
  },

  getUser(): User | null {
    const raw = sessionStorage.getItem(KEYS.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  setUser(user: User): void {
    sessionStorage.setItem(KEYS.user, JSON.stringify(user));
  },
  removeUser(): void {
    sessionStorage.removeItem(KEYS.user);
  },

  getPendingListing(): string | null {
    return sessionStorage.getItem(KEYS.pendingListing);
  },
  setPendingListing(listingId: string): void {
    sessionStorage.setItem(KEYS.pendingListing, listingId);
  },
  removePendingListing(): void {
    sessionStorage.removeItem(KEYS.pendingListing);
  },

  clearAll(): void {
    sessionStorage.removeItem(KEYS.token);
    sessionStorage.removeItem(KEYS.user);
    sessionStorage.removeItem(KEYS.pendingListing);
  },
};
