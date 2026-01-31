import { Card } from "@/app/components/ui/card";
import { Trophy } from "lucide-react";

interface LeaderboardCardProps {
  hasData?: boolean;
}

export function LeaderboardCard({ hasData = false }: LeaderboardCardProps) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Trophy className="w-5 h-5 text-green-600" />
        <h2 className="font-semibold text-gray-900">Leaderboard</h2>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center py-12 sm:py-16">
          <p className="text-gray-400 text-sm">No leaderboard data yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Leaderboard content would go here */}
        </div>
      )}
    </Card>
  );
}