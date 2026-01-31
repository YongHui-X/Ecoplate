import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import { Leaf, Utensils, DollarSign, Star, Car, TreePine, Zap } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  summary: {
    totalCo2Reduced: number;
    totalFoodSaved: number;
    totalMoneySaved: number;
    ecoPointsEarned: number;
  };
  co2ChartData: Array<{ date: string; value: number }>;
  foodChartData: Array<{ date: string; value: number }>;
  impactEquivalence: {
    carKmAvoided: number;
    treesPlanted: number;
    electricitySaved: number;
  };
}

type Tab = "summary" | "co2" | "financial" | "food";
type Period = "day" | "month" | "annual";

const tabs: { key: Tab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "co2", label: "CO₂" },
  { key: "financial", label: "Financial" },
  { key: "food", label: "Food" },
];

const periods: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "annual", label: "Annual" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [activePeriod, setActivePeriod] = useState<Period>("month");
  const { user } = useAuth();

  useEffect(() => {
    loadStats();
  }, [activePeriod]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get<DashboardStats>(
        `/dashboard/stats?period=${activePeriod}`
      );
      setData(response);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const summary = data?.summary;

  const statCards = [
    {
      label: "Total CO₂ Reduced",
      value: `${summary?.totalCo2Reduced ?? 0} kg`,
      icon: Leaf,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Food Saved",
      value: `${summary?.totalFoodSaved ?? 0} kg`,
      icon: Utensils,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Total Money Saved",
      value: `$${summary?.totalMoneySaved ?? 0}`,
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "EcoPoints Earned",
      value: `${summary?.ecoPointsEarned ?? 0}`,
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ];

  const impactItems = [
    {
      label: "Car km avoided",
      value: data?.impactEquivalence.carKmAvoided ?? 0,
      unit: "km",
      icon: Car,
    },
    {
      label: "Trees planted equivalent",
      value: data?.impactEquivalence.treesPlanted ?? 0,
      unit: "",
      icon: TreePine,
    },
    {
      label: "Electricity saved",
      value: data?.impactEquivalence.electricitySaved ?? 0,
      unit: "kWh",
      icon: Zap,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {getGreeting()}, {user?.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's your sustainability overview
        </p>
      </div>

      {/* Tab buttons + Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activePeriod === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      {(activeTab === "summary" || activeTab === "co2" || activeTab === "financial" || activeTab === "food") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="card-hover">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${card.bg}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {card.label}
                    </p>
                    <p className="text-xl font-bold">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CO2 Chart */}
      {(activeTab === "summary" || activeTab === "co2") && (
        <Card>
          <CardContent className="p-4 lg:p-6">
            <h3 className="text-base font-semibold mb-4">
              CO₂ Reduction Over Time
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.co2ChartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="CO₂ (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Food Chart */}
      {(activeTab === "summary" || activeTab === "food") && (
        <Card>
          <CardContent className="p-4 lg:p-6">
            <h3 className="text-base font-semibold mb-4">
              Food Saved Over Time
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.foodChartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Food (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial - show money saved chart placeholder on financial tab */}
      {activeTab === "financial" && (
        <Card>
          <CardContent className="p-4 lg:p-6">
            <h3 className="text-base font-semibold mb-4">
              Money Saved Overview
            </h3>
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-2 text-blue-500/50" />
                <p className="text-2xl font-bold text-foreground">
                  ${summary?.totalMoneySaved ?? 0}
                </p>
                <p className="text-sm mt-1">Total saved from marketplace sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Equivalence */}
      {activeTab === "summary" && (
        <Card>
          <CardContent className="p-4 lg:p-6">
            <h3 className="text-base font-semibold mb-4">Impact Equivalence</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {impactItems.map((item) => (
                <div
                  key={item.label}
                  className="text-center p-4 rounded-xl bg-muted/50"
                >
                  <item.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-xl font-bold">
                    {item.value}
                    {item.unit && (
                      <span className="text-sm font-normal ml-1">
                        {item.unit}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
