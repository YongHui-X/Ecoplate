import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import {
  Trophy,
  ArrowLeft,
  Coins,
  Star,
  Sparkles,
  Check,
  Share,
  DollarSign,
  X,
  Lightbulb,
  Gift,
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

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof Check;
    points: number;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  consumed: {
    label: "Consumed",
    icon: Check,
    points: 5,
    color: "text-success",
    bgColor: "bg-success/10",
    description: "Eat food before it expires",
  },
  shared: {
    label: "Shared",
    icon: Share,
    points: 10,
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "Share food with others in the community",
  },
  sold: {
    label: "Sold",
    icon: DollarSign,
    points: 8,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    description: "Sell items on the marketplace",
  },
  wasted: {
    label: "Wasted",
    icon: X,
    points: -3,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    description: "Letting food go to waste loses points",
  },
};

function getActionBreakdown(transactions: PointsData["transactions"]) {
  const grouped: Record<string, { count: number; totalPoints: number }> = {};

  for (const tx of transactions) {
    const action = tx.action;
    if (!grouped[action]) {
      grouped[action] = { count: 0, totalPoints: 0 };
    }
    grouped[action].count++;
    grouped[action].totalPoints += tx.amount;
  }

  return grouped;
}

export default function EcopointsPage() {
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const breakdown = getActionBreakdown(pointsData?.transactions || []);
  const recentTransactions = (pointsData?.transactions || []).slice(0, 20);

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
            Your full points breakdown
          </p>
        </div>
      </div>

      {/* Points Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {pointsData?.points.total || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {pointsData?.points.available || 0}
            </p>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-secondary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {pointsData?.points.lifetime || 0}
            </p>
            <p className="text-xs text-muted-foreground">Lifetime</p>
          </CardContent>
        </Card>
      </div>

      {/* Points Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            Points Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(ACTION_CONFIG).map(([action, config]) => {
            const data = breakdown[action];
            const Icon = config.icon;
            return (
              <div
                key={action}
                className={`flex items-center justify-between p-3 rounded-xl ${config.bgColor}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-card flex items-center justify-center">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {config.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data?.count || 0} transaction{(data?.count || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${config.color}`}>
                    {(data?.totalPoints || 0) > 0 ? "+" : ""}
                    {data?.totalPoints || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config.points > 0 ? "+" : ""}
                    {config.points} per item
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const config = ACTION_CONFIG[tx.action];
                const Icon = config?.icon || Check;
                const color = config?.color || "text-muted-foreground";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <div>
                        <p className="font-medium text-sm capitalize text-foreground">
                          {tx.action.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(ACTION_CONFIG).map(([action, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={action}
                  className={`p-3 rounded-xl ${config.bgColor}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="font-medium text-sm text-foreground">
                      {config.label}
                    </span>
                  </div>
                  <p className={`text-lg font-bold ${config.color}`}>
                    {config.points > 0 ? "+" : ""}
                    {config.points} pts
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {config.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-4">
            <p className="font-medium text-sm text-foreground mb-2">
              Tips to maximize your points:
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>
                <span className="font-medium text-primary">Share food</span> --
                highest reward at +10 points per item
              </li>
              <li>
                <span className="font-medium text-secondary">Sell on marketplace</span> --
                earn +8 points while reducing waste
              </li>
              <li>
                <span className="font-medium text-success">Consume items</span> --
                +5 points for eating food before it expires
              </li>
              <li>
                <span className="font-medium text-destructive">Avoid waste</span> --
                wasting food costs you -3 points
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Redeem Points */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-5 w-5 text-accent" />
            Redeem Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Gift className="h-8 w-8 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">
              {pointsData?.points.available || 0} points available
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              Redemption options coming soon! Keep earning points to unlock
              rewards when this feature launches.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
