import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Flame, Trophy } from "lucide-react";

interface EcoPointsCardProps {
  totalPoints: number;
  dayStreak: number;
  bestStreak: number;
  lifetimePoints: number;
  availablePoints: number;
  onViewDetails: () => void;
}

export function EcoPointsCard({
  totalPoints,
  dayStreak,
  bestStreak,
  lifetimePoints,
  availablePoints,
  onViewDetails,
}: EcoPointsCardProps) {
  return (
    <Card className="p-4 sm:p-6 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h2 className="font-semibold text-gray-900">Eco Points</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewDetails}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          View Details →
        </Button>
      </div>

      {/* Total Points */}
      <div className="text-center mb-4 sm:mb-6">
        <div className="text-4xl sm:text-5xl font-bold mb-1 text-green-600">{totalPoints}</div>
        <div className="text-sm text-gray-600">Total Points</div>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className="w-4 h-4 text-green-600" />
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{dayStreak}</span>
          </div>
          <div className="text-xs text-gray-600">Day Streak</div>
        </div>

        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy className="w-4 h-4 text-green-600" />
            <span className="text-xl sm:text-2xl font-bold text-gray-900">{bestStreak}</span>
          </div>
          <div className="text-xs text-gray-600">Best Streak</div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Lifetime Points</span>
          <span className="font-semibold text-gray-900">{lifetimePoints}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Available Points</span>
          <span className="font-semibold text-gray-900">{availablePoints}</span>
        </div>
      </div>
    </Card>
  );
}