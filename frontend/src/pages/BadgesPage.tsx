import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { Award, Lock, Check } from "lucide-react";

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
}

interface BadgesResponse {
  badges: BadgeData[];
  totalEarned: number;
  totalAvailable: number;
}

const categoryLabels: Record<string, string> = {
  "waste-reduction": "Waste Reduction",
  sharing: "Sharing",
  streaks: "Streaks",
  milestones: "Milestones",
};

const categoryColors: Record<string, string> = {
  "waste-reduction": "bg-green-100 text-green-800",
  sharing: "bg-blue-100 text-blue-800",
  streaks: "bg-orange-100 text-orange-800",
  milestones: "bg-purple-100 text-purple-800",
};

export default function BadgesPage() {
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="text-gray-600">
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
                <p className="text-gray-600">Badges Earned</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-medium text-primary">
                {badges.filter((b) => b.earned).reduce((sum, b) => sum + b.pointsAwarded, 0)}
              </p>
              <p className="text-sm text-gray-600">Points from badges</p>
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
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-400"
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
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>

                  {badge.category && (
                    <Badge
                      className={cn("mt-1", categoryColors[badge.category])}
                    >
                      {categoryLabels[badge.category]}
                    </Badge>
                  )}

                  <p className="text-sm text-gray-600 mt-2">
                    {badge.description}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium text-primary">
                      +{badge.pointsAwarded} pts
                    </span>
                    {badge.earned && badge.earnedAt && (
                      <span className="text-xs text-gray-500">
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
            <p className="text-gray-500">No badges in this category</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
