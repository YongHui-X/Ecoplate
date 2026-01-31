import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Trophy,
  Leaf,
  TrendingUp,
  Flame,
  Award,
  Users,
  Check,
  X,
  Share,
  DollarSign,
} from "lucide-react";

interface PointsData {
  points: {
    total: number;
    available: number;
    lifetime: number;
    currentStreak: number;
    longestStreak: number;
  };
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    action: string;
    createdAt: string;
  }>;
}

interface MetricsData {
  totalItemsConsumed: number;
  totalItemsWasted: number;
  totalItemsShared: number;
  totalItemsSold: number;
  estimatedMoneySaved: number;
  estimatedCo2Saved: number;
  wasteReductionRate: number;
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
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [points, metricsData, leaderboardData] = await Promise.all([
        api.get<PointsData>("/gamification/points"),
        api.get<MetricsData>("/gamification/metrics"),
        api.get<LeaderboardEntry[]>("/gamification/leaderboard"),
      ]);
      setPointsData(points);
      setMetrics(metricsData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Failed to load gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">EcoBoard</h1>
        <p className="text-gray-600">Track your sustainability journey</p>
      </div>

      {/* 4-Panel Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Points & Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Eco Points
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/ecopoints">View Details</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">
                {pointsData?.points.total || 0}
              </div>
              <p className="text-gray-600">Total Points</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-orange-500">
                  <Flame className="h-5 w-5" />
                  <span className="text-2xl font-bold">
                    {pointsData?.points.currentStreak || 0}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Day Streak</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">
                  {pointsData?.points.longestStreak || 0}
                </div>
                <p className="text-sm text-gray-600">Best Streak</p>
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

        {/* Panel 2: Sustainability Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-500" />
              Environmental Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-4xl font-bold text-green-600">
                {(metrics?.estimatedCo2Saved || 0).toFixed(1)} kg
              </div>
              <p className="text-green-700">CO2 Saved</p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Waste Reduction Rate</span>
                  <span className="font-medium">
                    {(metrics?.wasteReductionRate || 0).toFixed(0)}%
                  </span>
                </div>
                <Progress value={metrics?.wasteReductionRate || 0} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600">
                    ${(metrics?.estimatedMoneySaved || 0).toFixed(0)}
                  </div>
                  <p className="text-xs text-gray-600">Money Saved</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">
                    {(metrics?.totalItemsConsumed || 0) +
                      (metrics?.totalItemsShared || 0) +
                      (metrics?.totalItemsSold || 0)}
                  </div>
                  <p className="text-xs text-gray-600">Items Saved</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 3: Item Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span>Consumed</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  {metrics?.totalItemsConsumed || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Share className="h-5 w-5 text-blue-600" />
                  <span>Shared</span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {metrics?.totalItemsShared || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span>Sold</span>
                </div>
                <span className="text-xl font-bold text-purple-600">
                  {metrics?.totalItemsSold || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-red-600" />
                  <span>Wasted</span>
                </div>
                <span className="text-xl font-bold text-red-600">
                  {metrics?.totalItemsWasted || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel 4: Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No leaderboard data yet
              </p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1
                          ? "bg-yellow-100 text-yellow-700"
                          : entry.rank === 2
                          ? "bg-gray-100 text-gray-700"
                          : entry.rank === 3
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{entry.name}</p>
                      <p className="text-xs text-gray-500">
                        {entry.streak} day streak
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{entry.points}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/badges">
              <Award className="h-4 w-4 mr-2" />
              View Badges
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(pointsData?.transactions?.length || 0) === 0 ? (
            <p className="text-center text-gray-500 py-8">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {pointsData?.transactions.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {tx.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-500">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
