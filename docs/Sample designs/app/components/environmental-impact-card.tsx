import { Card } from "@/app/components/ui/card";
import { Leaf } from "lucide-react";

interface EnvironmentalImpactCardProps {
  co2Saved: number;
  wasteReductionRate: number;
  moneySaved: number;
  itemsSaved: number;
}

export function EnvironmentalImpactCard({
  co2Saved,
  wasteReductionRate,
  moneySaved,
  itemsSaved,
}: EnvironmentalImpactCardProps) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-xl">🌱</span>
        <h2 className="font-semibold text-gray-900">Environmental Impact</h2>
      </div>

      {/* CO2 Saved */}
      <div className="text-center mb-4 sm:mb-6 p-4 sm:p-6 bg-green-50 rounded-lg">
        <div className="text-4xl sm:text-5xl font-bold text-green-600 mb-1">{co2Saved.toFixed(1)} kg</div>
        <div className="text-sm text-gray-600">CO2 Saved</div>
      </div>

      {/* Waste Reduction Rate */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Waste Reduction Rate</span>
          <span className="text-sm font-semibold text-gray-900">{wasteReductionRate}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${wasteReductionRate}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="text-center">
          <div className="text-xl sm:text-2xl font-bold text-green-600">${moneySaved}</div>
          <div className="text-xs text-gray-600">Money Saved</div>
        </div>
        <div className="text-center">
          <div className="text-xl sm:text-2xl font-bold text-green-600">{itemsSaved}</div>
          <div className="text-xs text-gray-600">Items Saved</div>
        </div>
      </div>
    </Card>
  );
}