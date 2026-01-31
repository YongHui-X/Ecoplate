import { Sidebar } from "@/app/components/sidebar";
import { MobileNav } from "@/app/components/mobile-nav";
import { EcoPointsCard } from "@/app/components/eco-points-card";
import { EnvironmentalImpactCard } from "@/app/components/environmental-impact-card";
import { ActivitySummaryCard } from "@/app/components/activity-summary-card";
import { LeaderboardCard } from "@/app/components/leaderboard-card";

interface EcoboardDashboardProps {
  onViewPointsDetails: () => void;
}

export function EcoboardDashboard({ onViewPointsDetails }: EcoboardDashboardProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Desktop Only */}
      <Sidebar activePage="ecoboard" />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">EcoBoard</h1>
            <p className="text-sm sm:text-base text-gray-600">Track your sustainability journey</p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Eco Points */}
            <EcoPointsCard
              totalPoints={0}
              dayStreak={0}
              bestStreak={0}
              lifetimePoints={0}
              availablePoints={0}
              onViewDetails={onViewPointsDetails}
            />

            {/* Environmental Impact */}
            <EnvironmentalImpactCard
              co2Saved={0.0}
              wasteReductionRate={100}
              moneySaved={0}
              itemsSaved={0}
            />

            {/* Activity Summary */}
            <ActivitySummaryCard
              consumed={0}
              shared={0}
              sold={0}
              wasted={0}
            />

            {/* Leaderboard */}
            <LeaderboardCard hasData={false} />
          </div>
        </div>
      </main>

      {/* Mobile Navigation - Mobile Only */}
      <MobileNav activePage="ecoboard" />
    </div>
  );
}