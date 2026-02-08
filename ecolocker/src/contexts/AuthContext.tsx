import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api, verifyAuthToken } from "../services/api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  listingId: number | null;
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
      localStorage.setItem("ecolocker_token", ssoToken);

      // Clear URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Store listing ID if provided
      if (listingIdParam) {
        setListingId(parseInt(listingIdParam, 10));
        localStorage.setItem("ecolocker_pending_listing", listingIdParam);
      }

      // Verify the token and get user info
      verifyToken(ssoToken);
    } else {
      // Check for existing token
      const token = localStorage.getItem("ecolocker_token");
      const userData = localStorage.getItem("ecolocker_user");
      const pendingListing = localStorage.getItem("ecolocker_pending_listing");

      if (pendingListing) {
        setListingId(parseInt(pendingListing, 10));
      }

      if (token && userData) {
        try {
          setUser(JSON.parse(userData));
        } catch {
          localStorage.removeItem("ecolocker_token");
          localStorage.removeItem("ecolocker_user");
        }
      }
      setLoading(false);
    }
  }, []);

  async function verifyToken(token: string) {
    try {
      // Use the token to get current user info
      localStorage.setItem("ecolocker_token", token);
      const response = await verifyAuthToken();
      if (response) {
        localStorage.setItem("ecolocker_user", JSON.stringify(response));
        setUser(response);
      } else {
        localStorage.removeItem("ecolocker_token");
        localStorage.removeItem("ecolocker_user");
      }
    } catch {
      localStorage.removeItem("ecolocker_token");
      localStorage.removeItem("ecolocker_user");
    } finally {
      setLoading(false);
    }
  }

  const login = async (email: string, password: string) => {
    const response = await api.post<{
      user: User;
      token: string;
    }>("/auth/login", { email, password });

    localStorage.setItem("ecolocker_token", response.token);
    localStorage.setItem("ecolocker_user", JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem("ecolocker_token");
    localStorage.removeItem("ecolocker_user");
    localStorage.removeItem("ecolocker_pending_listing");
    setUser(null);
    setListingId(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, listingId, login, logout }}>
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
