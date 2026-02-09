import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";

export interface PointsData {
  totalPoints: number;
  currentStreak: number;
  totalCo2Saved: number;
}

interface PointsContextType {
  points: PointsData | null;
  loading: boolean;
  refreshPoints: () => Promise<void>;
}

const PointsContext = createContext<PointsContextType | null>(null);

export function PointsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [points, setPoints] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPoints = async () => {
    if (!user) {
      setPoints(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get<PointsData>("/gamification/points");
      setPoints(response);
    } catch (error) {
      console.error("Failed to refresh points:", error);
      // Don't throw, just log the error to allow graceful degradation
    } finally {
      setLoading(false);
    }
  };

  // Fetch points on mount and when user changes
  useEffect(() => {
    refreshPoints();
  }, [user]);

  // Listen for points:updated event from other components
  useEffect(() => {
    const handlePointsUpdated = () => {
      refreshPoints();
    };

    window.addEventListener("points:updated", handlePointsUpdated);
    return () => window.removeEventListener("points:updated", handlePointsUpdated);
  }, []);

  return (
    <PointsContext.Provider value={{ points, loading, refreshPoints }}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const context = useContext(PointsContext);
  if (!context) {
    throw new Error("usePoints must be used within a PointsProvider");
  }
  return context;
}
