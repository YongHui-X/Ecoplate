import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";
import { Award, Lock, Check, ArrowLeft } from "lucide-react";

interface BadgeProgress {
  current: number;
  target: number;
  percentage: number;
}

interface BadgeData {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  pointsAwarded: number;
  imageUrl: string | null;
  earned: boolean;
  earnedAt: string | null;
  progress: BadgeProgress | null;
}

interface BadgesResponse {
  badges: BadgeData[];
  totalEarned: number;
  totalAvailable: number;
}

const categoryLabels: Record<string, string> = {
  milestones: "Milestones",
  "waste-reduction": "Waste Reduction",
  sharing: "Sharing",
  streaks: "Streaks",
};

const categoryColors: Record<string, string> = {
  milestones: "bg-primary/10 text-primary",
  "waste-reduction": "bg-success/10 text-success",
  sharing: "bg-blue-500/10 text-blue-600",
  streaks: "bg-orange-500/10 text-orange-600",
};

function BadgeSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24 mt-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BadgesPage() {
  const navigate = useNavigate();
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const data = await api.get<BadgesResponse>("/gamification/badges");
      setBadges(data.badges);
    } catch (error) {
      console.error("Failed to load badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const earnedCount = badges.filter((b) => b.earned).length;
  const categories = ["all", ...Object.keys(categoryLabels)];

  const filteredBadges =
    selectedCategory === "all"
      ? badges
      : badges.filter((b) => b.category === selectedCategory);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-full" />
                <div>
                  <Skeleton className="h-7 w-20 mb-1" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-6 w-12 mb-1" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <BadgeSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/ecopoints")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to EcoPoints
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="text-muted-foreground">
          Collect badges by completing sustainability challenges
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {earnedCount} / {badges.length}
                </p>
                <p className="text-muted-foreground">Badges Earned</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-medium text-primary">
                {badges.filter((b) => b.earned).reduce((sum, b) => sum + b.pointsAwarded, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Points from badges</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              selectedCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat === "all" ? "All" : categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Badges grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBadges.map((badge) => (
          <Card
            key={badge.id}
            className={cn(
              "transition-all",
              badge.earned
                ? "bg-gradient-to-br from-primary/5 to-primary/10"
                : "opacity-75"
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center shrink-0",
                    badge.earned
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {badge.earned ? (
                    <Award className="h-8 w-8" />
                  ) : (
                    <Lock className="h-6 w-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{badge.name}</h3>
                    {badge.earned && (
                      <Check className="h-4 w-4 text-success" />
                    )}
                  </div>

                  {badge.category && (
                    <Badge
                      className={cn("mt-1", categoryColors[badge.category])}
                    >
                      {categoryLabels[badge.category]}
                    </Badge>
                  )}

                  <p className="text-sm text-muted-foreground mt-2">
                    {badge.description}
                  </p>

                  {/* Progress bar for unearned badges */}
                  {!badge.earned && badge.progress && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{badge.progress.current} / {badge.progress.target}</span>
                        <span>{badge.progress.percentage}%</span>
                      </div>
                      <Progress value={badge.progress.percentage} />
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium text-primary">
                      +{badge.pointsAwarded} pts
                    </span>
                    {badge.earned && badge.earnedAt && (
                      <span className="text-xs text-muted-foreground">
                        Earned {new Date(badge.earnedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBadges.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No badges in this category</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
