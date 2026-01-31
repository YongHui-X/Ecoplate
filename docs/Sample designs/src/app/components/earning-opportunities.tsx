import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { CheckCircle2, Share2, DollarSign, Star, Gift, Users } from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: any;
  color: string;
  bgColor: string;
  action: string;
}

const opportunities: Opportunity[] = [
  {
    id: "1",
    title: "Complete a Product",
    description: "Finish your meal without wasting food",
    points: 50,
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    action: "Log Meal",
  },
  {
    id: "2",
    title: "Share with Community",
    description: "Donate or share excess food with neighbors",
    points: 75,
    icon: Share2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    action: "Share Now",
  },
  {
    id: "3",
    title: "Sell a Product",
    description: "List and sell products on the marketplace",
    points: 100,
    icon: DollarSign,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    action: "List Item",
  },
  {
    id: "4",
    title: "Daily Check-in",
    description: "Open the app and log your food activities",
    points: 10,
    icon: Star,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    action: "Check In",
  },
  {
    id: "5",
    title: "Invite Friends",
    description: "Refer a friend to join EcoPlate",
    points: 150,
    icon: Users,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    action: "Invite",
  },
  {
    id: "6",
    title: "Complete Challenges",
    description: "Participate in weekly sustainability challenges",
    points: 200,
    icon: Gift,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    action: "View Challenges",
  },
];

export function EarningOpportunities() {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <span className="text-xl">💡</span>
        <h2 className="text-lg sm:text-xl font-semibold">How to Earn More Points</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {opportunities.map((opportunity) => {
          const Icon = opportunity.icon;

          return (
            <div
              key={opportunity.id}
              className={`p-3 sm:p-4 rounded-lg border-2 border-gray-100 hover:border-gray-200 transition-all ${opportunity.bgColor}`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${opportunity.bgColor} flex items-center justify-center flex-shrink-0 border-2 border-white`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${opportunity.color}`} />
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                    {opportunity.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">
                    {opportunity.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className={`font-bold text-base sm:text-lg ${opportunity.color}`}>
                      +{opportunity.points} pts
                    </div>
                    <Button size="sm" variant="outline" className="text-xs h-7 sm:h-8">
                      {opportunity.action}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}