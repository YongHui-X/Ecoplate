import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import {
  Leaf,
  Trash2,
  Utensils,
  DollarSign,
  Car,
  TreePine,
  Zap,
  TrendingUp,
  Clock,
  ShieldCheck,
  Package,
  Info,
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
    totalCo2Wasted: number;
    totalFoodSold: number;
    totalMoneySaved: number;
  };
  co2ChartData: Array<{ date: string; value: number }>;
  foodChartData: Array<{ date: string; value: number }>;
  wasteRatioChartData: Array<{ date: string; wasted: number; consumed: number; ratio: number }>;
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
  wasteRatioChartData: Array<{ date: string; wasted: number; consumed: number; ratio: number }>;
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
  { key: "co2", label: "CO₂" },
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
        const stats = await api.get<DashboardStats>(`/dashboard/stats?period=${p}`);
        setSummaryData(stats);
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
        label: "Total CO₂ Wasted",
        value: `${summary?.totalCo2Wasted ?? 0} kg`,
        icon: Trash2,
        color: "text-red-500",
        bg: "bg-red-500/10",
        tooltip: "CO₂ emissions from food you wasted during consumption tracking",
      },
      {
        label: "Total CO₂ Reduced",
        value: `${summary?.totalCo2Reduced ?? 0} kg`,
        icon: Leaf,
        color: "text-primary",
        bg: "bg-primary/10",
        tooltip: "CO₂ emissions prevented by selling food on the marketplace instead of wasting it",
      },
      {
        label: "Total Food Sold",
        value: `${summary?.totalFoodSold ?? 0} kg`,
        icon: Utensils,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        tooltip: "Total weight of food sold through the marketplace",
      },
      {
        label: "Total Money Saved",
        value: `$${summary?.totalMoneySaved ?? 0}`,
        icon: DollarSign,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        tooltip: "Money earned from selling food on the marketplace",
      },
    ];

    const impactItems = [
      {
        label: "Car km avoided",
        value: summaryData?.impactEquivalence.carKmAvoided ?? 0,
        unit: "km",
        icon: Car,
        tooltip: "Equivalent car kilometers not driven based on CO₂ reduced",
      },
      {
        label: "Trees planted equivalent",
        value: summaryData?.impactEquivalence.treesPlanted ?? 0,
        unit: "",
        icon: TreePine,
        tooltip: "Number of trees needed to absorb the same amount of CO₂",
      },
      {
        label: "Electricity saved",
        value: summaryData?.impactEquivalence.electricitySaved ?? 0,
        unit: "kWh",
        icon: Zap,
        tooltip: "Equivalent electricity not consumed based on CO₂ reduced",
      },
    ];

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="card-hover relative">
              <CardContent className="p-2.5 sm:p-4">
                {card.tooltip && (
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 group">
                    <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                    <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      {card.tooltip}
                    </div>
                  </div>
                )}
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

        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                CO&#8322; Reduced by Selling
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  CO₂ emissions prevented over time by selling food on the marketplace
                </div>
              </div>
            </div>
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
                    name="CO₂ Reduced (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Food Saved Over Time
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Total weight of food consumed, sold, or shared over time
                </div>
              </div>
            </div>
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

        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                CO&#8322; Wasted vs Consumed
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Comparison of CO₂ from wasted food vs consumed food over time
                </div>
              </div>
            </div>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summaryData?.wasteRatioChartData || []}
                  margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="consumed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Consumed (kg)"
                  />
                  <Line
                    type="monotone"
                    dataKey="wasted"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Wasted (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Impact Equivalence
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Real-world equivalents of your CO₂ reduction impact
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {impactItems.map((item) => (
                <div
                  key={item.label}
                  className="text-center p-2 sm:p-4 rounded-lg sm:rounded-xl bg-muted/50 relative group/item"
                >
                  {item.tooltip && (
                    <div className="absolute top-1 right-1">
                      <Info className="h-3 w-3 text-muted-foreground/30 group-hover/item:text-muted-foreground/60" />
                      <div className="absolute right-0 top-4 w-40 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all z-50 text-left">
                        {item.tooltip}
                      </div>
                    </div>
                  )}
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

    const co2Cards = [
      {
        label: "Total CO₂ Reduced",
        value: `${co2Data.totalCo2Reduced} kg`,
        icon: Leaf,
        color: "text-primary",
        bg: "bg-primary/10",
        tooltip: "CO₂ emissions prevented by selling food on the marketplace instead of wasting it",
      },
      {
        label: "Car km Avoided",
        value: co2Data.impactEquivalence.carKmAvoided,
        icon: Car,
        color: "text-green-500",
        bg: "bg-green-500/10",
        tooltip: "Equivalent car kilometers not driven based on CO₂ reduced",
      },
      {
        label: "Trees Planted Equiv.",
        value: co2Data.impactEquivalence.treesPlanted,
        icon: TreePine,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        tooltip: "Number of trees needed to absorb the same amount of CO₂",
      },
      {
        label: "Electricity Saved",
        value: `${co2Data.impactEquivalence.electricitySaved} kWh`,
        icon: Zap,
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
        tooltip: "Equivalent electricity not consumed based on CO₂ reduced",
      },
    ];

    return (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {co2Cards.map((card) => (
            <Card key={card.label} className="card-hover relative">
              <CardContent className="p-2.5 sm:p-4">
                {card.tooltip && (
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 group">
                    <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                    <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      {card.tooltip}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${card.bg} flex-shrink-0`}>
                    <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
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

        {/* CO2 by Category Pie + Trend Line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden relative">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-semibold">
                  CO&#8322; by Category
                </h3>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    Breakdown of CO₂ emissions by food category
                  </div>
                </div>
              </div>
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
                      formatter={(value) => [`${value} kg`, "CO₂"]}
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
                      name="CO₂ (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Waste Ratio Chart */}
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
              CO&#8322; Wasted vs Consumed
            </h3>
            <div className="h-48 sm:h-64 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={co2Data.wasteRatioChartData || []}
                  margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10 }} tickMargin={4} width={35} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="consumed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Consumed (kg)"
                  />
                  <Line
                    type="monotone"
                    dataKey="wasted"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Wasted (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Items */}
        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Top Items by CO&#8322; Saved
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Food items that contributed most to CO₂ reduction
                </div>
              </div>
            </div>
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
                    formatter={(value) => [`${value} kg`, "CO₂"]}
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

    const financialCards = [
      {
        label: "Total Earned",
        value: `$${financialData.totalEarned}`,
        icon: TrendingUp,
        color: "text-green-500",
        bg: "bg-green-500/10",
        tooltip: "Total money earned from selling food on the marketplace",
      },
      {
        label: "Saved by Buying",
        value: `$${financialData.totalSavedByBuying}`,
        icon: ShieldCheck,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        tooltip: "Money saved by buying discounted food from the marketplace",
      },
      {
        label: "Items Sold",
        value: financialData.totalListingsSold,
        icon: Package,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        tooltip: "Total number of listings you have sold",
      },
      {
        label: "Avg Time to Sell",
        value: `${financialData.avgTimeToSell}h`,
        icon: Clock,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        tooltip: "Average time it takes for your listings to sell",
      },
    ];

    return (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {financialCards.map((card) => (
            <Card key={card.label} className="card-hover relative">
              <CardContent className="p-2.5 sm:p-4">
                {card.tooltip && (
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 group">
                    <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                    <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      {card.tooltip}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${card.bg} flex-shrink-0`}>
                    <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
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

        {/* Savings over time */}
        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Earnings Over Time
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Your marketplace earnings over time
                </div>
              </div>
            </div>
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
          <Card className="overflow-hidden relative">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-semibold">
                  Sales Speed
                </h3>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    How quickly your listings sell after being posted
                  </div>
                </div>
              </div>
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

          <Card className="overflow-hidden relative">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-semibold">
                  Discount Distribution
                </h3>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    Distribution of discount percentages on your sold listings
                  </div>
                </div>
              </div>
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
        <Card className="overflow-hidden relative">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Price Comparison
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Compare your listing prices vs original prices for sold items
                </div>
              </div>
            </div>
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

    const foodCards = [
      {
        title: "Consumed",
        value: `${foodData.totalConsumed} kg`,
        icon: Utensils,
        bgColor: "bg-green-500/10",
        iconColor: "text-green-500",
        tooltip: "Total weight of food you've consumed from your inventory",
      },
      {
        title: "Wasted",
        value: `${foodData.totalWasted} kg`,
        icon: Trash2,
        bgColor: "bg-red-500/10",
        iconColor: "text-red-500",
        tooltip: "Food that expired or was thrown away without being consumed",
      },
      {
        title: "Waste Rate",
        value: `${foodData.wasteRate}%`,
        icon: Trash2,
        bgColor: "bg-yellow-500/10",
        iconColor: "text-yellow-500",
        tooltip: "Percentage of food wasted compared to total consumed and wasted",
      },
      {
        title: "Sold",
        value: `${foodData.totalSold} kg`,
        icon: DollarSign,
        bgColor: "bg-orange-500/10",
        iconColor: "text-orange-500",
        tooltip: "Food you've sold through the marketplace before it expired",
      },
    ];

    return (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {foodCards.map((card, index) => {
            const IconComponent = card.icon;
            return (
              <Card key={index} className="card-hover">
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${card.bgColor} flex-shrink-0`}>
                      <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                          {card.title}
                        </p>
                        <div className="relative group flex-shrink-0">
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border rounded shadow-lg text-xs w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            {card.tooltip}
                          </div>
                        </div>
                      </div>
                      <p className="text-base sm:text-xl font-bold truncate">
                        {card.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Food by Category Pie + Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-semibold">
                  Food by Category
                </h3>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    Distribution of your food consumption by category
                  </div>
                </div>
              </div>
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
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-semibold">
                  Saved vs Wasted Trend
                </h3>
                <div className="group relative">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    Comparison of food saved (consumed + sold + shared) vs wasted over time
                  </div>
                </div>
              </div>
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
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Top Items by Quantity
              </h3>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                <div className="absolute right-0 top-5 w-48 sm:w-56 p-2 bg-popover border rounded-md shadow-lg text-xs text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  Your most frequently tracked food items by weight
                </div>
              </div>
            </div>
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
