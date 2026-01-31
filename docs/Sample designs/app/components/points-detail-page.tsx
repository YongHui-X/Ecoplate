import { ArrowLeft, Download, Share } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { PointsSummaryCard } from "@/app/components/points-summary-card";
import { PointsHistory } from "@/app/components/points-history";
import { PointsBreakdown } from "@/app/components/points-breakdown";
import { EarningOpportunities } from "@/app/components/earning-opportunities";

interface PointsDetailPageProps {
  onBack?: () => void;
}

export function PointsDetailPage({ onBack }: PointsDetailPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3 sm:gap-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="p-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Eco Points</h1>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Track your sustainability journey</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 h-8 sm:h-9">
                <Share className="w-4 h-4" />
                <span className="hidden md:inline">Share</span>
              </Button>
              <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 h-8 sm:h-9">
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">Export</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Points Summary */}
          <PointsSummaryCard
            totalPoints={0}
            dayStreak={0}
            bestStreak={0}
            lifetimePoints={0}
            availablePoints={0}
          />

          {/* Two Column Layout for Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Points Breakdown */}
            <PointsBreakdown />

            {/* Points History */}
            <PointsHistory />
          </div>

          {/* Earning Opportunities */}
          <EarningOpportunities />
        </div>
      </div>
    </div>
  );
}