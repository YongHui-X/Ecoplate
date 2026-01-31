import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { CheckCircle2, Share2, DollarSign, XCircle, Plus, Minus, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PointsTransaction {
  id: string;
  type: "earned" | "spent";
  category: "consumed" | "shared" | "sold" | "wasted" | "reward";
  points: number;
  description: string;
  date: Date;
}

const mockTransactions: PointsTransaction[] = [
  {
    id: "1",
    type: "earned",
    category: "consumed",
    points: 50,
    description: "Finished meal completely",
    date: new Date(2026, 0, 27, 14, 30),
  },
  {
    id: "2",
    type: "earned",
    category: "shared",
    points: 75,
    description: "Shared leftovers with neighbor",
    date: new Date(2026, 0, 26, 19, 15),
  },
  {
    id: "3",
    type: "spent",
    category: "reward",
    points: 100,
    description: "Redeemed: Premium Fridge Pack",
    date: new Date(2026, 0, 25, 10, 0),
  },
  {
    id: "4",
    type: "earned",
    category: "sold",
    points: 120,
    description: "Sold 2kg vegetables",
    date: new Date(2026, 0, 24, 16, 45),
  },
  {
    id: "5",
    type: "earned",
    category: "consumed",
    points: 30,
    description: "Consumed product",
    date: new Date(2026, 0, 23, 12, 20),
  },
  {
    id: "6",
    type: "earned",
    category: "shared",
    points: 60,
    description: "Donated food to community",
    date: new Date(2026, 0, 22, 18, 0),
  },
  {
    id: "7",
    type: "spent",
    category: "reward",
    points: 50,
    description: "Redeemed: $5 Marketplace Credit",
    date: new Date(2026, 0, 21, 11, 30),
  },
  {
    id: "8",
    type: "earned",
    category: "consumed",
    points: 45,
    description: "Zero waste meal",
    date: new Date(2026, 0, 20, 13, 15),
  },
];

const categoryIcons = {
  consumed: CheckCircle2,
  shared: Share2,
  sold: DollarSign,
  wasted: XCircle,
  reward: Plus,
};

const categoryColors = {
  consumed: "text-green-600 bg-green-50",
  shared: "text-blue-600 bg-blue-50",
  sold: "text-purple-600 bg-purple-50",
  wasted: "text-red-600 bg-red-50",
  reward: "text-orange-600 bg-orange-50",
};

export function PointsHistory() {
  const [filter, setFilter] = useState<"all" | "earned" | "spent">("all");

  const filteredTransactions = mockTransactions.filter((t) => {
    if (filter === "all") return true;
    return t.type === filter;
  });

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Calendar className="w-5 h-5 text-green-600" />
        <h2 className="text-lg sm:text-xl font-semibold">Points History</h2>
      </div>

      {/* Filter Tabs */}
      <Tabs defaultValue="all" className="mb-4" onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="earned">Earned</TabsTrigger>
          <TabsTrigger value="spent">Spent</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Transactions List */}
      <div className="space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
        {filteredTransactions.map((transaction) => {
          const Icon = categoryIcons[transaction.category];
          const colorClass = categoryColors[transaction.category];

          return (
            <div
              key={transaction.id}
              className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate text-sm sm:text-base">
                  {transaction.description}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  {format(transaction.date, "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>

              {/* Points */}
              <div
                className={`font-bold text-base sm:text-lg flex items-center gap-1 ${
                  transaction.type === "earned" ? "text-green-600" : "text-red-600"
                }`}
              >
                {transaction.type === "earned" ? (
                  <Plus className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                {transaction.points}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}