import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils";
import {
    Award,
    Lock,
    Check,
    Sparkles,
    Rocket,
    Star,
    Trophy,
    Utensils,
    Eye,
    Shield,
    Leaf,
    ShoppingBag,
    Store,
    Crown,
    Heart,
    Flame,
    Calendar,
    CalendarDays,
    CalendarCheck,
    type LucideIcon, ArrowLeft,
} from "lucide-react";
import {useNavigate} from "react-router-dom";

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

// Badge-specific icons and colors
const badgeConfig: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  // Milestones
  first_action: { icon: Sparkles, color: "text-primary", bgColor: "bg-primary" },
  eco_starter: { icon: Rocket, color: "text-primary", bgColor: "bg-primary" },
  eco_enthusiast: { icon: Star, color: "text-primary", bgColor: "bg-primary" },
  eco_champion: { icon: Trophy, color: "text-yellow-500", bgColor: "bg-yellow-500" },
  // Waste Reduction
  first_consume: { icon: Utensils, color: "text-success", bgColor: "bg-success" },
  waste_watcher: { icon: Eye, color: "text-success", bgColor: "bg-success" },
  waste_warrior: { icon: Shield, color: "text-success", bgColor: "bg-success" },
  zero_waste_hero: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-emerald-500" },
  // Sharing
  first_sale: { icon: ShoppingBag, color: "text-blue-500", bgColor: "bg-blue-500" },
  marketplace_regular: { icon: Store, color: "text-blue-500", bgColor: "bg-blue-500" },
  marketplace_pro: { icon: Crown, color: "text-blue-500", bgColor: "bg-blue-500" },
  sharing_champion: { icon: Heart, color: "text-pink-500", bgColor: "bg-pink-500" },
  // Streaks
  streak_3: { icon: Flame, color: "text-orange-500", bgColor: "bg-orange-500" },
  streak_7: { icon: Calendar, color: "text-orange-500", bgColor: "bg-orange-500" },
  streak_14: { icon: CalendarDays, color: "text-orange-500", bgColor: "bg-orange-500" },
  streak_30: { icon: CalendarCheck, color: "text-red-500", bgColor: "bg-red-500" },
};

// Default config for unknown badges
const defaultBadgeConfig = { icon: Award, color: "text-primary", bgColor: "bg-primary" };

function getBadgeConfig(code: string) {
  return badgeConfig[code] || defaultBadgeConfig;
}

function BadgeSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shrink-0" />
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
      // First, sync badges to award any newly earned ones
      await api.post("/gamification/sync-badges", {});

      // Then fetch the updated badges list
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-full" />
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
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <BadgeSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" className="lg:hidden mb-2" onClick={() => navigate("/ecopoints")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to EcoPoints
        </Button>
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="text-muted-foreground">
          Collect badges by completing sustainability challenges
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-full bg-primary/10">
                <Award className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">
                  {earnedCount} / {badges.length}
                </p>
                <p className="text-sm text-muted-foreground">Badges Earned</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base sm:text-lg font-medium text-primary">
                {badges.filter((b) => b.earned).reduce((sum, b) => sum + b.pointsAwarded, 0)}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Points from badges</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredBadges.map((badge) => {
          const config = getBadgeConfig(badge.code);
          const IconComponent = config.icon;

          return (
            <Card
              key={badge.id}
              className={cn(
                "transition-all overflow-hidden",
                badge.earned
                  ? "bg-gradient-to-br from-primary/5 to-primary/10 ring-1 ring-primary/20"
                  : "opacity-60 grayscale-[30%]"
              )}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Badge Icon */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all",
                        badge.earned
                          ? `${config.bgColor} text-white shadow-lg`
                          : "bg-muted/80 text-muted-foreground"
                      )}
                    >
                      <IconComponent className={cn(
                        "h-7 w-7 sm:h-8 sm:w-8",
                        badge.earned ? "drop-shadow-sm" : ""
                      )} />
                    </div>

                    {/* Lock overlay for unearned badges */}
                    {!badge.earned && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted-foreground/80 flex items-center justify-center shadow-sm">
                        <Lock className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Checkmark for earned badges */}
                    {badge.earned && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-sm">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        "font-semibold text-sm sm:text-base",
                        badge.earned ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {badge.name}
                      </h3>
                    </div>

                    {badge.category && (
                      <Badge
                        className={cn(
                          "mt-1 text-[10px] sm:text-xs",
                          badge.earned
                            ? categoryColors[badge.category]
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {categoryLabels[badge.category]}
                      </Badge>
                    )}

                    <p className={cn(
                      "text-xs sm:text-sm mt-2 line-clamp-2",
                      badge.earned ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}>
                      {badge.description}
                    </p>

                    {/* Progress bar for unearned badges */}
                    {!badge.earned && badge.progress && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                          <span>{badge.progress.current} / {badge.progress.target}</span>
                          <span>{badge.progress.percentage}%</span>
                        </div>
                        <Progress value={badge.progress.percentage} className="h-1.5 sm:h-2" />
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <span className={cn(
                        "text-xs sm:text-sm font-medium",
                        badge.earned ? "text-primary" : "text-muted-foreground"
                      )}>
                        +{badge.pointsAwarded} pts
                      </span>
                      {badge.earned && badge.earnedAt && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {new Date(badge.earnedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
