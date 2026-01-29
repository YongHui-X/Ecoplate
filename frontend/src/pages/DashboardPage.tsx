import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";
import { Refrigerator, Store, Trophy, AlertTriangle, TrendingUp, Leaf, ChevronRight, Sparkles } from "lucide-react";
import { getDaysUntilExpiry, getExpiryStatus } from "../lib/utils";

interface DashboardData {
  products: {
    total: number;
    expiringToday: number;
    expiringSoon: number;
  };
  listings: {
    active: number;
    sold: number;
  };
  gamification: {
    points: number;
    streak: number;
    wasteReductionRate: number;
    co2Saved: number;
  };
  expiringProducts: Array<{
    id: number;
    name: string;
    expiryDate: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get<DashboardData>("/gamification/dashboard");
      setData(response);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Skeleton hero card */}
        <Skeleton className="h-32 w-full rounded-2xl" />
        {/* Skeleton stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with greeting */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {getGreeting()}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">Here's your sustainability overview</p>
      </div>

      {/* Hero Stats Card - Eco Points */}
      <div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary-foreground/80 text-sm font-medium mb-1">
                <Sparkles className="h-4 w-4" />
                <span>Eco Points</span>
              </div>
              <div className="text-4xl lg:text-5xl font-bold">
                {data?.gamification.points || 0}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>{data?.gamification.streak || 0} day streak</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-primary-foreground/80 text-sm mb-1">CO2 Saved</div>
              <div className="text-3xl font-bold flex items-baseline gap-1">
                {(data?.gamification.co2Saved || 0).toFixed(1)}
                <span className="text-lg font-normal">kg</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-primary-foreground/80 mt-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Helping the planet</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Refrigerator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Fridge Items</p>
                <p className="text-xl font-bold">{data?.products.total || 0}</p>
              </div>
            </div>
            {(data?.products.expiringSoon || 0) > 0 && (
              <p className="text-xs text-warning mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {data?.products.expiringSoon} expiring soon
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-secondary/10">
                <Store className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Listings</p>
                <p className="text-xl font-bold">{data?.listings.active || 0}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data?.listings.sold || 0} sold total
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/10">
                <Leaf className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Waste Reduced</p>
                <p className="text-xl font-bold">{(data?.gamification.wasteReductionRate || 0).toFixed(0)}%</p>
              </div>
            </div>
            <Progress value={data?.gamification.wasteReductionRate || 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/10">
                <Trophy className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Today's Expiring</p>
                <p className="text-xl font-bold">{data?.products.expiringToday || 0}</p>
              </div>
            </div>
            {(data?.products.expiringToday || 0) > 0 && (
              <p className="text-xs text-destructive mt-2">Needs attention!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon */}
      {(data?.expiringProducts?.length || 0) > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <CardTitle className="text-base">Expiring Soon</CardTitle>
            </div>
            <Link to="/myfridge" className="text-sm text-primary font-medium flex items-center gap-1">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {data?.expiringProducts.slice(0, 4).map((product) => {
                const days = getDaysUntilExpiry(product.expiryDate);
                const status = getExpiryStatus(product.expiryDate);
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                  >
                    <span className="font-medium text-sm">{product.name}</span>
                    <Badge
                      variant={
                        status === "expired"
                          ? "destructive"
                          : status === "expiring-soon"
                          ? "warning"
                          : "success"
                      }
                      className="text-xs"
                    >
                      {days !== null && days < 0
                        ? "Expired"
                        : days === 0
                        ? "Today"
                        : `${days}d left`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        <Link to="/myfridge">
          <Card className="card-hover press-effect h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                <Refrigerator className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Manage Fridge</h3>
                <p className="text-sm text-muted-foreground">
                  Add items or scan receipts
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/marketplace/create">
          <Card className="card-hover press-effect h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5">
                <Store className="h-6 w-6 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Share Food</h3>
                <p className="text-sm text-muted-foreground">
                  List items on marketplace
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
