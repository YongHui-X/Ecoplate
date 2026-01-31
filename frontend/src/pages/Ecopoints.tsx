import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ArrowLeft,
  Flame,
  Trophy,
  TrendingUp,
  CalendarDays,
  Lightbulb,
  Check,
  Share,
  DollarSign,
  X,
  ChevronDown,
  ChevronUp,
  Leaf,
} from "lucide-react";

interface PointsData {
  points: {
    total: number;
    available: number;
    lifetime: number;
    currentStreak: number;
    longestStreak: number;
  };
  stats: {
    totalActiveDays: number;
    lastActiveDate: string | null;
    firstActivityDate: string | null;
    pointsToday: number;
    pointsThisWeek: number;
    pointsThisMonth: number;
    bestDayPoints: number;
    averagePointsPerActiveDay: number;
  };
  breakdown: Record<string, { count: number; totalPoints: number }>;
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    action: string;
    createdAt: string;
  }>;
}

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof Check;
    points: number;
    color: string;
    bgColor: string;
    chartColor: string;
    description: string;
  }
> = {
  consumed: {
    label: "Consumed",
    icon: Check,
    points: 5,
    color: "text-success",
    bgColor: "bg-success/10",
    chartColor: "hsl(var(--success))",
    description: "Eat food before it expires",
  },
  shared: {
    label: "Shared",
    icon: Share,
    points: 10,
    color: "text-primary",
    bgColor: "bg-primary/10",
    chartColor: "hsl(var(--primary))",
    description: "Share excess food with others",
  },
  sold: {
    label: "Sold",
    icon: DollarSign,
    points: 8,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    chartColor: "hsl(var(--secondary))",
    description: "Sell products on the marketplace",
  },
  wasted: {
    label: "Wasted",
    icon: X,
    points: -3,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    chartColor: "hsl(var(--destructive))",
    description: "Wasting food costs you points",
  },
};

const INITIAL_TX_COUNT = 10;

export default function EcopointsPage() {
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllTx, setShowAllTx] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.get<PointsData>("/gamification/points");
      setPointsData(data);
    } catch (error) {
      console.error("Failed to load points data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-8 w-40" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const breakdown = pointsData?.breakdown || {};
  const transactions = pointsData?.transactions || [];
  const visibleTx = showAllTx ? transactions : transactions.slice(0, INITIAL_TX_COUNT);

  // Pie chart data -- only include types with positive counts
  const pieData = Object.entries(ACTION_CONFIG)
    .filter(([action]) => (breakdown[action]?.count || 0) > 0)
    .map(([action, config]) => ({
      name: config.label,
      value: breakdown[action]?.totalPoints || 0,
      count: breakdown[action]?.count || 0,
      color: config.chartColor,
      action,
    }));

  const totalPoints = pieData.reduce((sum, d) => sum + Math.abs(d.value), 0);
  const totalItems = Object.values(breakdown).reduce((sum, b) => sum + b.count, 0);
  const hasPieData = pieData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/ecoboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Eco Points</h1>
          <p className="text-muted-foreground text-sm">
            Track Your Eco Wins
          </p>
        </div>
      </div>

      {/* Points Summary Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Total Points - Large Display */}
          <div className="text-center mb-6">
            <p className="text-5xl sm:text-6xl font-bold text-primary">
              {pointsData?.points.total || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Total Points</p>
          </div>

          {/* 2x2 Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Day Streak */}
            <div className="flex items-start gap-3 p-3 sm:p-4 bg-warning/10 rounded-xl">
              <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {pointsData?.points.currentStreak || 0}
                </p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>

            {/* Best Streak */}
            <div className="flex items-start gap-3 p-3 sm:p-4 bg-accent/10 rounded-xl">
              <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {pointsData?.points.longestStreak || 0}
                </p>
                <p className="text-xs text-muted-foreground">Best Streak</p>
              </div>
            </div>

            {/* Total Items */}
            <div className="flex items-start gap-3 p-3 sm:p-4 bg-primary/10 rounded-xl">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {totalItems}
                </p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>

            {/* This Month */}
            <div className="flex items-start gap-3 p-3 sm:p-4 bg-success/10 rounded-xl">
              <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {pointsData?.stats.pointsThisMonth || 0}
                </p>
                <p className="text-xs text-muted-foreground">Points earned this Month</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Points Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Leaf className="h-5 w-5 text-primary" />
            Points Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasPieData ? (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Pie Chart */}
              <div className="w-full lg:w-1/2 h-[200px] sm:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                      label={(props: { name?: string; percent?: number }) =>
                        `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => [
                        `${Math.abs(Number(value) || 0)} pts`,
                        String(name ?? ""),
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown List */}
              <div className="w-full lg:w-1/2 space-y-3">
                {pieData.map((entry) => {
                  const pct =
                    totalPoints > 0
                      ? ((Math.abs(entry.value) / totalPoints) * 100).toFixed(1)
                      : "0";
                  const config = ACTION_CONFIG[entry.action];
                  const Icon = config?.icon || Check;

                  return (
                    <div key={entry.name} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `color-mix(in srgb, ${entry.color} 15%, transparent)` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: entry.color }} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground text-sm">
                            {entry.name}
                          </span>
                          <span
                            className="font-bold text-sm"
                            style={{ color: entry.color }}
                          >
                            {entry.value > 0 ? "+" : ""}
                            {entry.value} pts
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: entry.color,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pct}% &middot; {entry.count} items
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Leaf className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                No activity yet. Start earning points!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Points History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {visibleTx.map((tx) => {
                const config = ACTION_CONFIG[tx.action];
                const Icon = config?.icon || Check;
                const color = config?.color || "text-muted-foreground";
                const bgColor = config?.bgColor || "bg-muted";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bgColor}`}
                    >
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm capitalize text-foreground truncate">
                        {tx.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={tx.amount > 0 ? "success" : "destructive"}
                      className="text-sm"
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount} pts
                    </Badge>
                  </div>
                );
              })}
              {transactions.length > INITIAL_TX_COUNT && (
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => setShowAllTx(!showAllTx)}
                >
                  {showAllTx ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show All ({transactions.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Earn More Points */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-warning" />
            How to Earn More Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(ACTION_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={key}
                  className={`p-3 sm:p-4 rounded-xl ${config.bgColor}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-sm">
                        {config.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                      <p className={`font-bold text-sm mt-2 ${config.color}`}>
                        {config.points > 0 ? "+" : ""}
                        {config.points} pts per item
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
