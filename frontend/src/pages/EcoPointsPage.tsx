import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import {
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
  Flame,
  Users,
  Check,
  BarChart3,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Award,
  ChevronRight,
  DollarSign,
  Gift,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ACTION_CONFIG, INITIAL_TX_COUNT } from "../constants/gamification";

interface PointsData {
  points: {
    total: number;
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
    productName: string;
    quantity: number;
    unit: string;
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
  const [showAllSold, setShowAllSold] = useState(false);
  const [showAllRedeem, setShowAllRedeem] = useState(false);
  const [showAllBadge, setShowAllBadge] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Listen for points:updated event from other components
  useEffect(() => {
    const handlePointsUpdated = () => {
      loadData();
    };

    window.addEventListener("points:updated", handlePointsUpdated);
    return () => window.removeEventListener("points:updated", handlePointsUpdated);
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
            <div className="md:col-span-2"><SkeletonCard /></div>
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
    );
  }

  const transactions = pointsData?.transactions || [];
  const soldTransactions = transactions.filter((tx) => tx.action !== "redeemed" && tx.action !== "badge");
  const badgeTransactions = transactions.filter((tx) => tx.action === "badge");
  const redeemTransactions = transactions.filter((tx) => tx.action === "redeemed");
  const visibleSold = showAllSold ? soldTransactions : soldTransactions.slice(0, INITIAL_TX_COUNT);
  const visibleBadge = showAllBadge ? badgeTransactions : badgeTransactions.slice(0, INITIAL_TX_COUNT);
  const visibleRedeem = showAllRedeem ? redeemTransactions : redeemTransactions.slice(0, INITIAL_TX_COUNT);


  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">EcoPoints</h1>
          <p className="text-muted-foreground">Track your sustainability journey</p>
        </div>

        {/* View Badges Link */}
        <Link
          to="/badges"
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border
                     active:scale-[0.98] transition-transform lg:hidden"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/10">
            <Award className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">View Badges</p>
            <p className="text-xs text-muted-foreground">See your achievements and progress</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>

        {/* 2x2 Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel 1: Points & Streak */}
          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                Eco Points
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6 pt-0 sm:pt-0 flex flex-col justify-center flex-1">
              <div className="text-center">
                <div className="text-3xl sm:text-5xl font-bold text-primary">
                  {pointsData?.points.total || 0}
                </div>
                <p className="text-muted-foreground text-sm">Total Points</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 text-center">
                <div className="p-2.5 sm:p-4 bg-muted/50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-warning">
                    <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xl sm:text-2xl font-bold">
                      {pointsData?.points.currentStreak || 0}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Day Streak</p>
                </div>
                <div className="p-2.5 sm:p-4 bg-muted/50 rounded-lg sm:rounded-xl">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {pointsData?.points.longestStreak || 0}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Best Streak</p>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Panel 2: Points Breakdown (monthly bar chart) */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Points Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {(() => {
                const monthlyData = (pointsData?.pointsByMonth || []).map((m) => {
                  const [, mm] = m.month.split("-");
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  return { label: monthNames[parseInt(mm, 10) - 1], points: Math.max(0, m.points) };
                });
                const hasData = monthlyData.some((d) => d.points > 0);

                return hasData ? (
                    <div className="h-[180px] sm:h-[220px] lg:h-[260px] -ml-2 sm:ml-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 10, right: 5, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickMargin={4} />
                          <YAxis tick={{ fontSize: 10 }} width={30} />
                          <Tooltip
                              formatter={(value: unknown) => [`${Number(value) || 0} pts`, "Points"]}
                              contentStyle={{
                                borderRadius: "12px",
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--card))",
                                color: "hsl(var(--foreground))",
                                fontSize: "12px",
                              }}
                          />
                          <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-6 sm:py-8">
                      <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">
                        No points earned yet. Start your journey!
                      </p>
                    </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Panel 3: Leaderboard */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {leaderboard.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                    No leaderboard data yet
                  </p>
              ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {leaderboard.slice(0, 5).map((entry) => (
                        <div
                            key={entry.userId}
                            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-muted/50"
                        >
                          <div
                              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
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
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{entry.name}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {entry.streak} day streak
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-primary text-sm">{entry.points}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">points</p>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Panel 5: Points History */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
                Sold Points History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {soldTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                    No sold transactions yet
                  </p>
              ) : (
                  <div className="space-y-1.5 sm:space-y-2 max-h-[230px] sm:max-h-[270px] overflow-y-auto">
                    {visibleSold.map((tx) => {
                      const config = ACTION_CONFIG[tx.action];
                      const Icon = config?.icon || Check;
                      const color = config?.color || "text-muted-foreground";
                      const bgColor = config?.bgColor || "bg-muted";
                      return (
                          <div
                              key={tx.id}
                              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/50"
                          >
                            <div
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bgColor}`}
                            >
                              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                                    {config?.label || tx.action}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <Badge
                                variant={tx.amount > 0 ? "success" : "destructive"}
                                className="text-xs sm:text-sm"
                            >
                              {tx.amount > 0 ? "+" : ""}
                              {tx.amount}
                            </Badge>
                          </div>
                      );
                    })}
                    {soldTransactions.length > INITIAL_TX_COUNT && (
                        <Button
                            variant="ghost"
                            className="w-full mt-2 text-sm"
                            onClick={() => setShowAllSold(!showAllSold)}
                        >
                          {showAllSold ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Show Less
                              </>
                          ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Show All ({soldTransactions.length})
                              </>
                          )}
                        </Button>
                    )}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Bonus Points From Badges */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Award className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                Bonus Points From Badges
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {badgeTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                    No badge bonus points yet
                  </p>
              ) : (
                  <div className="space-y-1.5 sm:space-y-2 max-h-[230px] sm:max-h-[270px] overflow-y-auto">
                    {visibleBadge.map((tx) => {
                      const config = ACTION_CONFIG[tx.action];
                      const Icon = config?.icon || Check;
                      const color = config?.color || "text-muted-foreground";
                      const bgColor = config?.bgColor || "bg-muted";
                      return (
                          <div
                              key={tx.id}
                              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/50"
                          >
                            <div
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bgColor}`}
                            >
                              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                                    {config?.label || tx.action}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <Badge
                                variant={tx.amount > 0 ? "success" : "destructive"}
                                className="text-xs sm:text-sm"
                            >
                              {tx.amount > 0 ? "+" : ""}
                              {tx.amount}
                            </Badge>
                          </div>
                      );
                    })}
                    {badgeTransactions.length > INITIAL_TX_COUNT && (
                        <Button
                            variant="ghost"
                            className="w-full mt-2 text-sm"
                            onClick={() => setShowAllBadge(!showAllBadge)}
                        >
                          {showAllBadge ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Show Less
                              </>
                          ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Show All ({badgeTransactions.length})
                              </>
                          )}
                        </Button>
                    )}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Redeem Points History */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                Redeem Points History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {redeemTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                    No redemptions yet
                  </p>
              ) : (
                  <div className="space-y-1.5 sm:space-y-2 max-h-[230px] sm:max-h-[270px] overflow-y-auto">
                    {visibleRedeem.map((tx) => {
                      const config = ACTION_CONFIG[tx.action];
                      const Icon = config?.icon || Check;
                      const color = config?.color || "text-muted-foreground";
                      const bgColor = config?.bgColor || "bg-muted";
                      return (
                          <div
                              key={tx.id}
                              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/50"
                          >
                            <div
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bgColor}`}
                            >
                              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                                    {config?.label || tx.action}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <Badge
                                variant={tx.amount > 0 ? "success" : "destructive"}
                                className="text-xs sm:text-sm"
                            >
                              {tx.amount > 0 ? "+" : ""}
                              {tx.amount}
                            </Badge>
                          </div>
                      );
                    })}
                    {redeemTransactions.length > INITIAL_TX_COUNT && (
                        <Button
                            variant="ghost"
                            className="w-full mt-2 text-sm"
                            onClick={() => setShowAllRedeem(!showAllRedeem)}
                        >
                          {showAllRedeem ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Show Less
                              </>
                          ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Show All ({redeemTransactions.length})
                              </>
                          )}
                        </Button>
                    )}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Points Guide */}
          <Card className="overflow-hidden md:col-span-2">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                Points Guide
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Earn points through sales and badges. Spend them on rewards.
              </p>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                {Object.entries(ACTION_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                      <div
                          key={key}
                          className={`p-2.5 sm:p-4 rounded-lg sm:rounded-xl ${config.bgColor}`}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground text-xs sm:text-sm">
                              {config.label}
                            </h3>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                              {config.description}
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
      </div>
  );
}