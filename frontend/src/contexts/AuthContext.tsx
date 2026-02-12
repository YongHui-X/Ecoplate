import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "../services/api";

interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
  userLocation?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, userLocation?: string, avatarUrl?: string) => Promise<void>;
  updateProfile: (data: { name?: string; avatarUrl?: string | null; userLocation?: string | null }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      localStorage.removeItem("ecoplate_unread_count");
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<{
      user: User;
      token: string;
    }>("/auth/login", { email, password });

    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));
    setUser(response.user);

    // Dispatch event to notify other contexts (like UnreadCount) that user logged in
    window.dispatchEvent(new CustomEvent("auth:login"));
  };

  const register = async (email: string, password: string, name: string, userLocation?: string, avatarUrl?: string) => {
    const response = await api.post<{
      user: User;
      token: string;
    }>("/auth/register", { email, password, name, userLocation, avatarUrl });

    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));
    setUser(response.user);
  };

  const updateProfile = async (data: { name?: string; avatarUrl?: string | null; userLocation?: string | null }) => {
    const response = await api.patch<User>("/auth/profile", data);
    localStorage.setItem("user", JSON.stringify(response));
    setUser(response);
    // Dispatch event to notify components of profile update
    window.dispatchEvent(new CustomEvent("auth:profileUpdate", { detail: response }));
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("ecoplate_unread_count");
    setUser(null);
    // Dispatch event to notify WebSocket and other contexts that user logged out
    window.dispatchEvent(new CustomEvent("auth:logout"));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout }}>
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
