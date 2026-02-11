import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api, verifyAuthToken } from "../services/api";
import { storage } from "../services/storage";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  listingId: number | null;
  clearListingId: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingId, setListingId] = useState<number | null>(null);

  useEffect(() => {
    // Check for SSO token in URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    const ssoToken = searchParams.get("token");
    const listingIdParam = searchParams.get("listingId");

    if (ssoToken) {
      // Store the SSO token
      storage.setToken(ssoToken);

      // Clear URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Store listing ID if provided
      if (listingIdParam) {
        setListingId(parseInt(listingIdParam, 10));
        storage.setPendingListing(listingIdParam);
      }

      // Verify the token and get user info
      verifyToken(ssoToken);
    } else {
      // Check for existing token
      const token = storage.getToken();
      const userData = storage.getUser();
      const pendingListing = storage.getPendingListing();

      if (pendingListing) {
        setListingId(parseInt(pendingListing, 10));
      }

      if (token && userData) {
        setUser(userData);
      }
      setLoading(false);
    }
  }, []);

  async function verifyToken(token: string) {
    try {
      // Use the token to get current user info
      storage.setToken(token);
      const response = await verifyAuthToken();
      if (response) {
        storage.setUser(response as User);
        setUser(response as User);
      } else {
        storage.removeToken();
        storage.removeUser();
      }
    } catch {
      storage.removeToken();
      storage.removeUser();
    } finally {
      setLoading(false);
    }
  }

  // Listen for 401 unauthorized events from api.ts to force re-login
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setListingId(null);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<{
      user: User;
      token: string;
    }>("/auth/login", { email, password });

    storage.setToken(response.token);
    storage.setUser(response.user);
    setUser(response.user);
  };

  const clearListingId = () => {
    setListingId(null);
    storage.removePendingListing();
  };

  const logout = () => {
    storage.clearAll();
    setUser(null);
    setListingId(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, listingId, clearListingId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
