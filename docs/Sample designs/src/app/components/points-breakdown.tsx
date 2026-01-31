import { Card } from "@/app/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { CheckCircle2, Share2, DollarSign, XCircle } from "lucide-react";

const data = [
  { name: "Consumed", value: 425, color: "#22c55e", icon: CheckCircle2 },
  { name: "Shared", value: 315, color: "#3b82f6", icon: Share2 },
  { name: "Sold", value: 240, color: "#8b5cf6", icon: DollarSign },
  { name: "Wasted", value: 20, color: "#ef4444", icon: XCircle },
];

export function PointsBreakdown() {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-xl">📊</span>
        <h2 className="text-lg sm:text-xl font-semibold">Points Breakdown</h2>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6 sm:gap-8">
        {/* Pie Chart */}
        <div className="w-full lg:w-1/2 h-[200px] sm:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown List */}
        <div className="w-full lg:w-1/2 space-y-3 sm:space-y-4">
          {data.map((item) => {
            const Icon = item.icon;
            const percentage = ((item.value / total) * 100).toFixed(1);

            return (
              <div key={item.name} className="flex items-center gap-3 sm:gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.color}20` }}
                >
                  <Icon className="w-5 h-5" style={{ color: item.color }} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 text-sm sm:text-base">{item.name}</span>
                    <span className="font-bold text-sm sm:text-base" style={{ color: item.color }}>
                      {item.value} pts
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{percentage}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}