import { Card } from "@/app/components/ui/card";
import { CheckCircle2, Share2, DollarSign, XCircle } from "lucide-react";

interface ActivitySummaryCardProps {
  consumed: number;
  shared: number;
  sold: number;
  wasted: number;
}

export function ActivitySummaryCard({
  consumed,
  shared,
  sold,
  wasted,
}: ActivitySummaryCardProps) {
  const activities = [
    {
      id: "consumed",
      label: "Consumed",
      value: consumed,
      icon: CheckCircle2,
      bgColor: "bg-green-50",
      textColor: "text-green-600",
    },
    {
      id: "shared",
      label: "Shared",
      value: shared,
      icon: Share2,
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      id: "sold",
      label: "Sold",
      value: sold,
      icon: DollarSign,
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
    },
    {
      id: "wasted",
      label: "Wasted",
      value: wasted,
      icon: XCircle,
      bgColor: "bg-red-50",
      textColor: "text-red-600",
    },
  ];

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-xl">📊</span>
        <h2 className="font-semibold text-gray-900">Activity Summary</h2>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = activity.icon;

          return (
            <div
              key={activity.id}
              className={`flex items-center justify-between p-3 sm:p-4 ${activity.bgColor} rounded-lg`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${activity.textColor}`} />
                <span className="font-medium text-gray-900 text-sm sm:text-base">{activity.label}</span>
              </div>
              <span className={`text-lg sm:text-xl font-bold ${activity.textColor}`}>
                {activity.value}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}