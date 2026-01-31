import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ChevronRight, TrendingUp } from "lucide-react";

interface PointsSummaryViewProps {
  onViewDetails: () => void;
}

export function PointsSummaryView({ onViewDetails }: PointsSummaryViewProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h2 className="text-lg font-semibold">Eco Points</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewDetails}
          className="flex items-center gap-1 text-green-600 hover:text-green-700"
        >
          View Details
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Total Points Display */}
      <div className="text-center py-6 mb-4 bg-green-50 rounded-lg">
        <div className="text-5xl font-bold text-green-600 mb-1">0</div>
        <div className="text-sm text-gray-600">Total Points</div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">0</div>
          <div className="text-xs text-gray-600">Day Streak 🔥</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">0</div>
          <div className="text-xs text-gray-600">Best Streak 🏆</div>
        </div>
      </div>

      {/* Points This Month */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">+283 points this month</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
