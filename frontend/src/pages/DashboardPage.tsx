import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import {
  Leaf,
  Utensils,
  DollarSign,
  Star,
  Car,
  TreePine,
  Zap,
  TrendingUp,
  Clock,
  ShieldCheck,
  Package,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// ==================== Types ====================

interface DashboardStats {
  summary: {
    totalCo2Reduced: number;
    totalFoodSaved: number;
    totalMoneySaved: number;
  };
  co2ChartData: Array<{ date: string; value: number }>;
  foodChartData: Array<{ date: string; value: number }>;
  impactEquivalence: {
    carKmAvoided: number;
    treesPlanted: number;
    electricitySaved: number;
  };
}

interface CO2Data {
  totalCo2Reduced: number;
  co2ByCategory: Array<{ name: string; value: number }>;
  co2Trend: Array<{ date: string; value: number }>;
  topItems: Array<{ name: string; value: number }>;
  impactEquivalence: {
    carKmAvoided: number;
    treesPlanted: number;
    electricitySaved: number;
  };
}

interface FinancialData {
  totalEarned: number;
  totalSpent: number;
  totalSavedByBuying: number;
  totalListingsSold: number;
  totalPurchases: number;
  avgTimeToSell: number;
  savingsOverTime: Array<{ date: string; value: number }>;
  priceComparison: Array<{
    name: string;
    originalPrice: number;
    sellingPrice: number;
  }>;
  discountDistribution: Array<{ range: string; count: number }>;
  salesSpeed: Array<{ range: string; count: number }>;
}

interface FoodData {
  totalConsumed: number;
  totalWasted: number;
  totalShared: number;
  totalSold: number;
  wasteRate: number;
  foodByCategory: Array<{ name: string; value: number }>;
  foodTrend: Array<{ date: string; saved: number; wasted: number }>;
  topItems: Array<{ name: string; value: number }>;
}

interface PointsData {
  points: {
    total: number;
    available: number;
    lifetime: number;
    currentStreak: number;
    longestStreak: number;
  };
  stats: {
    pointsToday: number;
    pointsThisWeek: number;
    pointsThisMonth: number;
  };
}

type Tab = "summary" | "co2" | "financial" | "food";
type Period = "day" | "month" | "annual";

const PIE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];

const tabs: { key: Tab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "co2", label: "CO\u2082" },
  { key: "financial", label: "Financial" },
  { key: "food", label: "Food" },
];

const periods: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "annual", label: "Annual" },
];

// ==================== Component ====================

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState<DashboardStats | null>(null);
  const [co2Data, setCo2Data] = useState<CO2Data | null>(null);
  const [financialData, setFinancialData] = useState<FinancialData | null>(
    null
  );
  const [foodData, setFoodData] = useState<FoodData | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [activePeriod, setActivePeriod] = useState<Period>("month");
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [activePeriod, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const p = activePeriod;

      if (activeTab === "summary") {
        const [stats, points] = await Promise.all([
          api.get<DashboardStats>(`/dashboard/stats?period=${p}`),
          api.get<PointsData>("/gamification/points"),
        ]);
        setSummaryData(stats);
        setPointsData(points);
      } else if (activeTab === "co2") {
        const stats = await api.get<CO2Data>(`/dashboard/co2?period=${p}`);
        setCo2Data(stats);
      } else if (activeTab === "financial") {
        const stats = await api.get<FinancialData>(
          `/dashboard/financial?period=${p}`
        );
        setFinancialData(stats);
      } else if (activeTab === "food") {
        const stats = await api.get<FoodData>(`/dashboard/food?period=${p}`);
        setFoodData(stats);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
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

  // ==================== Render Helpers ====================

  const renderSummaryTab = () => {
    const summary = summaryData?.summary;
    const statCards = [
      {
        label: "Total CO\u2082 Reduced",
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
        label:
          activePeriod === "day"
            ? "EcoPoints (Today)"
            : activePeriod === "month"
              ? "EcoPoints (Month)"
              : "EcoPoints (Annual)",
        value: `${
          activePeriod === "day"
            ? (pointsData?.stats?.pointsToday ?? 0)
            : activePeriod === "month"
              ? (pointsData?.stats?.pointsThisMonth ?? 0)
              : (pointsData?.points.total ?? 0)
        }`,
        icon: Star,
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
      },
    ];

    const impactItems = [
      {
        label: "Car km avoided",
        value: summaryData?.impactEquivalence.carKmAvoided ?? 0,
        unit: "km",
        icon: Car,
      },
      {
        label: "Trees planted equivalent",
        value: summaryData?.impactEquivalence.treesPlanted ?? 0,
        unit: "",
        icon: TreePine,
      },
      {
        label: "Electricity saved",
        value: summaryData?.impactEquivalence.electricitySaved ?? 0,
        unit: "kWh",
        icon: Zap,
      },
    ];

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="card-hover">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${card.bg} flex-shrink-0`}
                  >
                    <card.icon
                      className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                      {card.label}
                    </p>
                    <p className="text-base sm:text-xl font-bold truncate">
                      {card.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              CO&#8322; Saved Over Time
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summaryData?.co2ChartData || []}
                  margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="CO\u2082 (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Food Saved Over Time
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summaryData?.foodChartData || []}
                  margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Food (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Impact Equivalence
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {impactItems.map((item) => (
                <div
                  key={item.label}
                  className="text-center p-2 sm:p-4 rounded-lg sm:rounded-xl bg-muted/50"
                >
                  <item.icon className="h-5 w-5 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2 text-primary" />
                  <p className="text-sm sm:text-xl font-bold">
                    {item.value}
                    {item.unit && (
                      <span className="text-[10px] sm:text-sm font-normal ml-0.5 sm:ml-1">
                        {item.unit}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const renderCO2Tab = () => {
    if (!co2Data) return null;
    return (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/10 flex-shrink-0">
                  <Leaf className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Total CO&#8322; Reduced
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {co2Data.totalCo2Reduced} kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-green-500/10 flex-shrink-0">
                  <Car className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Car km Avoided
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {co2Data.impactEquivalence.carKmAvoided}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-500/10 flex-shrink-0">
                  <TreePine className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Trees Planted Equiv.
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {co2Data.impactEquivalence.treesPlanted}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-yellow-500/10 flex-shrink-0">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Electricity Saved
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {co2Data.impactEquivalence.electricitySaved} kWh
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CO2 by Category Pie + Trend Line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                CO&#8322; by Category
              </h3>
              <div className="h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={co2Data.co2ByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      outerRadius="65%"
                      label={({ percent }) =>
                        (percent ?? 0) > 0.01
                          ? `${((percent ?? 0) * 100).toFixed(0)}%`
                          : ""
                      }
                      labelLine={false}
                      fontSize={11}
                    >
                      {co2Data.co2ByCategory.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} kg`, "CO\u2082"]}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11, paddingTop: 5 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                CO&#8322; Reduction Trend
              </h3>
              <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={co2Data.co2Trend}
                    margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickMargin={8}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="CO\u2082 (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Items */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Top Items by CO&#8322; Saved
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={co2Data.topItems}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} kg`, "CO\u2082"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const renderFinancialTab = () => {
    if (!financialData) return null;
    return (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-green-500/10 flex-shrink-0">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Total Earned
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    ${financialData.totalEarned}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-500/10 flex-shrink-0">
                  <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Saved by Buying
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    ${financialData.totalSavedByBuying}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-orange-500/10 flex-shrink-0">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Items Sold
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {financialData.totalListingsSold}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-purple-500/10 flex-shrink-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Avg Time to Sell
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {financialData.avgTimeToSell}h
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Savings over time */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Earnings Over Time
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={financialData.savingsOverTime}
                  margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickMargin={8}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip
                    formatter={(value) => [`$${value}`, "Earned"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Earned ($)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales Speed + Discount Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                Sales Speed
              </h3>
              <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={financialData.salesSpeed}
                    margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 10 }}
                      tickMargin={8}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={25} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="count"
                      fill="#f59e0b"
                      name="Listings"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                Discount Distribution
              </h3>
              <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={financialData.discountDistribution}
                    margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 10 }}
                      tickMargin={8}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={25} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      name="Listings"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Comparison */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Price Comparison
            </h3>
            <div className="h-64 sm:h-80 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={financialData.priceComparison}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    width={140}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="originalPrice"
                    fill="#94a3b8"
                    name="Original Price"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="sellingPrice"
                    fill="#22c55e"
                    name="Selling Price"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const renderFoodTab = () => {
    if (!foodData) return null;

    return (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-green-500/10 flex-shrink-0">
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Consumed
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {foodData.totalConsumed} kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-red-500/10 flex-shrink-0">
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Wasted ({foodData.wasteRate}%)
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {foodData.totalWasted} kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-500/10 flex-shrink-0">
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Shared
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {foodData.totalShared} kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-orange-500/10 flex-shrink-0">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                    Sold
                  </p>
                  <p className="text-base sm:text-xl font-bold truncate">
                    {foodData.totalSold} kg
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Food by Category Pie + Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                Food by Category
              </h3>
              <div className="h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={foodData.foodByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      outerRadius="65%"
                      label={({ percent }) =>
                        (percent ?? 0) > 0.01
                          ? `${((percent ?? 0) * 100).toFixed(0)}%`
                          : ""
                      }
                      labelLine={false}
                      fontSize={11}
                    >
                      {foodData.foodByCategory.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} kg`, "Quantity"]}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11, paddingTop: 5 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                Saved vs Wasted Trend
              </h3>
              <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={foodData.foodTrend}
                    margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickMargin={8}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="saved"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      name="Saved (kg)"
                    />
                    <Line
                      type="monotone"
                      dataKey="wasted"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      name="Wasted (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Items */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              Top Items by Quantity
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={foodData.topItems}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} kg`, "Quantity"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="#f97316" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  // ==================== Main Render ====================

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex bg-muted rounded-lg sm:rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex bg-muted rounded-lg sm:rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 self-start sm:self-auto">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p.key)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-colors ${
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

      {/* Tab Content */}
      {activeTab === "summary" && renderSummaryTab()}
      {activeTab === "co2" && renderCO2Tab()}
      {activeTab === "financial" && renderFinancialTab()}
      {activeTab === "food" && renderFoodTab()}
    </div>
  );
}
