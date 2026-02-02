import { useEffect, useState } from "react";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Trophy,
  Leaf,
  Flame,
  Users,
  Check,
  BarChart3,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ACTION_CONFIG, INITIAL_TX_COUNT } from "../constants/gamification";

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
  pointsByMonth: Array<{ month: string; points: number }>;
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    action: string;
    createdAt: string;
  }>;
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  points: number;
  streak: number;
}

export default function EcoBoardPage() {
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTx, setShowAllTx] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [points, leaderboardData] = await Promise.all([
        api.get<PointsData>("/gamification/points"),
        api.get<LeaderboardEntry[]>("/gamification/leaderboard"),
      ]);
      setPointsData(points);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Failed to load gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-60 mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
    );
  }

  const breakdown = pointsData?.breakdown || {};
  const transactions = pointsData?.transactions || [];
  const visibleTx = showAllTx ? transactions : transactions.slice(0, INITIAL_TX_COUNT);

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
  const hasPieData = pieData.length > 0;

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">EcoPoints</h1>
          <p className="text-muted-foreground">Track your sustainability journey</p>
        </div>

        {/* 2x2 Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel 1: Points & Streak */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-warning" />
                Eco Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">
                  {pointsData?.points.total || 0}
                </div>
                <p className="text-muted-foreground">Total Points</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-warning">
                    <Flame className="h-5 w-5" />
                    <span className="text-2xl font-bold">
                    {pointsData?.points.currentStreak || 0}
                  </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="text-2xl font-bold text-foreground">
                    {pointsData?.points.longestStreak || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Best Streak</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Lifetime Points</span>
                  <span className="font-medium">
                  {pointsData?.points.lifetime || 0}
                </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Available Points</span>
                  <span className="font-medium">
                  {pointsData?.points.available || 0}
                </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Panel 2: Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Leaf className="h-5 w-5 text-primary" />
                Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasPieData ? (
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    {/* Pie Chart */}
                    <div className="w-full lg:w-3/5 h-[200px] sm:h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                              data={pieData}
                              cx="45%"
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
                    <div className="w-full lg:w-2/5 space-y-3">
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

          {/* Panel 3: Points Breakdown (monthly bar chart) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Points Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const monthlyData = (pointsData?.pointsByMonth || []).map((m) => {
                  const [, mm] = m.month.split("-");
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  return { label: monthNames[parseInt(mm, 10) - 1], points: m.points };
                });
                const hasData = monthlyData.some((d) => d.points > 0);

                return hasData ? (
                    <div className="h-[220px] sm:h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                              formatter={(value: unknown) => [`${Number(value) || 0} pts`, "Points"]}
                              contentStyle={{
                                borderRadius: "12px",
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--card))",
                                color: "hsl(var(--foreground))",
                              }}
                          />
                          <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        No points earned yet. Start your journey!
                      </p>
                    </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Panel 4: Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No leaderboard data yet
                  </p>
              ) : (
                  <div className="space-y-3">
                    {leaderboard.slice(0, 5).map((entry) => (
                        <div
                            key={entry.userId}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50"
                        >
                          <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                  entry.rank === 1
                                      ? "bg-warning/20 text-warning"
                                      : entry.rank === 2
                                          ? "bg-muted text-muted-foreground"
                                          : entry.rank === 3
                                              ? "bg-secondary/20 text-secondary"
                                              : "bg-muted/50 text-muted-foreground"
                              }`}
                          >
                            {entry.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.streak} day streak
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">{entry.points}</p>
                            <p className="text-xs text-muted-foreground">points</p>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Points History */}
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