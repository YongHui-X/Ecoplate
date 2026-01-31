import { TrendingUp, Flame, Trophy, Clock } from "lucide-react";
import { Card } from "@/app/components/ui/card";

interface PointsSummaryCardProps {
  totalPoints: number;
  dayStreak: number;
  bestStreak: number;
  lifetimePoints: number;
  availablePoints: number;
}

export function PointsSummaryCard({
  totalPoints,
  dayStreak,
  bestStreak,
  lifetimePoints,
  availablePoints,
}: PointsSummaryCardProps) {
  return (
    <Card className="p-4 sm:p-6 bg-white border border-gray-200">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-2xl">🏆</span>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Eco Points</h2>
      </div>

      {/* Total Points - Large Display */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="text-5xl sm:text-6xl font-bold mb-2 text-green-600">{totalPoints}</div>
        <div className="text-sm text-gray-600">Total Points</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Day Streak */}
        <div className="flex items-start gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Flame className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{dayStreak}</div>
            <div className="text-xs text-gray-600">Day Streak</div>
          </div>
        </div>

        {/* Best Streak */}
        <div className="flex items-start gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{bestStreak}</div>
            <div className="text-xs text-gray-600">Best Streak</div>
          </div>
        </div>

        {/* Lifetime Points */}
        <div className="flex items-start gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{lifetimePoints}</div>
            <div className="text-xs text-gray-600">Lifetime Points</div>
          </div>
        </div>

        {/* Available Points */}
        <div className="flex items-start gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{availablePoints}</div>
            <div className="text-xs text-gray-600">Available Points</div>
          </div>
        </div>
      </div>
    </Card>
  );
}