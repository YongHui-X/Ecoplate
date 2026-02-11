import { useState, useEffect } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Gift,
  Coins,
  UtensilsCrossed,
  Shirt,
  Loader2,
  CheckCircle,
  AlertCircle,
  History,
  Package,
  Ticket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { uploadService } from "../services/upload";

interface Reward {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  pointsCost: number;
  stock: number;
  isActive: boolean;
}

interface RedemptionResult {
  id: number;
  redemptionCode: string;
  pointsSpent: number;
  reward: Reward;
}

export default function RewardsPage() {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "food" | "apparel">("all");

  useEffect(() => {
    fetchRewardsAndBalance();
  }, []);

  const fetchRewardsAndBalance = async () => {
    try {
      setLoading(true);

      const [rewardsData, balanceData] = await Promise.all([
        api.get<Reward[]>("/rewards"),
        api.get<{ balance: number }>("/rewards/balance"),
      ]);

      setRewards(rewardsData);
      setBalance(balanceData.balance);
    } catch (err) {
      console.error("Failed to fetch rewards:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;

    setRedeeming(true);
    setError(null);

    try {
      const data = await api.post<RedemptionResult>("/rewards/redeem", { rewardId: selectedReward.id });

      setRedemptionResult(data);
      setBalance((prev) => prev - selectedReward.pointsCost);

      setRewards((prev) =>
        prev.map((r) =>
          r.id === selectedReward.id ? { ...r, stock: r.stock - 1 } : r
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to redeem reward. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  const closeDialog = () => {
    setSelectedReward(null);
    setRedemptionResult(null);
    setError(null);
  };

  const filteredRewards = rewards.filter((r) => {
    if (filter === "all") return true;
    return r.category === filter;
  });

  const getCategoryIcon = (category: string) => {
    return category === "apparel" ? (
      <Shirt className="h-4 w-4" />
    ) : (
      <UtensilsCrossed className="h-4 w-4" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Rewards</h1>
          <p className="text-muted-foreground">Redeem your EcoPoints for rewards</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/rewards/my-redemptions")}
        >
          <History className="h-4 w-4 mr-2" />
          My Redemptions
        </Button>
      </div>

      {/* Balance Card */}
      <div className="p-6 mb-6 rounded-2xl shadow-sm bg-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Your Balance</p>
            <div className="flex items-center gap-2">
              <Coins className="h-8 w-8" />
              <span className="text-4xl font-bold">{balance.toLocaleString()}</span>
              <span className="text-xl">points</span>
            </div>
          </div>
          <Gift className="h-16 w-16 opacity-50" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "food" ? "default" : "outline"}
          onClick={() => setFilter("food")}
        >
          <UtensilsCrossed className="h-4 w-4 mr-2" />
          Food & Beverage
        </Button>
        <Button
          variant={filter === "apparel" ? "default" : "outline"}
          onClick={() => setFilter("apparel")}
        >
          <Shirt className="h-4 w-4 mr-2" />
          Apparel
        </Button>
      </div>

      {/* Rewards Grid */}
      {filteredRewards.length === 0 ? (
        <Card className="p-8 text-center max-w-md mx-auto">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No rewards available</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRewards.map((reward) => (
            <Card
              key={reward.id}
              className={`overflow-hidden hover:shadow-lg transition-shadow ${
                reward.stock === 0 ? "opacity-60" : ""
              }`}
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
                {reward.imageUrl ? (
                  <img
                    src={uploadService.getImageUrl(reward.imageUrl)}
                    alt={reward.name}
                    className="w-full h-full object-contain bg-white"
                  />
                ) : reward.category === "physical" ? (
                  <Package className="h-16 w-16 text-muted-foreground" />
                ) : (
                  <Ticket className="h-16 w-16 text-muted-foreground" />
                )}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{reward.name}</h3>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {getCategoryIcon(reward.category)}
                    <span className="ml-1">
                      {reward.category === "apparel" ? "Apparel" : "F&B"}
                    </span>
                  </Badge>
                </div>

                {reward.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {reward.description}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1 text-primary font-semibold text-lg">
                      <Coins className="h-5 w-5" />
                      <span>{reward.pointsCost.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Stock: {reward.stock}
                    </span>
                  </div>

                  <Button
                    disabled={reward.stock === 0 || balance < reward.pointsCost}
                    onClick={() => setSelectedReward(reward)}
                  >
                    {reward.stock === 0
                      ? "Out of Stock"
                      : balance < reward.pointsCost
                      ? "Not Enough"
                      : "Redeem"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Redeem Confirmation Dialog */}
      <Dialog open={!!selectedReward && !redemptionResult} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem this reward?
            </DialogDescription>
          </DialogHeader>

          {selectedReward && (
            <div className="py-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                  {selectedReward.category === "physical" ? (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Ticket className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold">{selectedReward.name}</h4>
                  <div className="flex items-center gap-1 text-primary">
                    <Coins className="h-4 w-4" />
                    <span>{selectedReward.pointsCost.toLocaleString()} points</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg text-sm">
                <div className="flex justify-between mb-1">
                  <span>Your Balance:</span>
                  <span>{balance.toLocaleString()} points</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Cost:</span>
                  <span>-{selectedReward.pointsCost.toLocaleString()} points</span>
                </div>
                <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                  <span>Remaining:</span>
                  <span>
                    {(balance - selectedReward.pointsCost).toLocaleString()} points
                  </span>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={redeeming}>
              Cancel
            </Button>
            <Button onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redeeming...
                </>
              ) : (
                "Confirm Redemption"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={!!redemptionResult} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Redemption Successful!
            </DialogTitle>
          </DialogHeader>

          {redemptionResult && (
            <div className="py-4">
              <p className="text-muted-foreground mb-4">
                You have successfully redeemed{" "}
                <span className="font-semibold">{redemptionResult.reward.name}</span>
              </p>

              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Your Redemption Code
                </p>
                <p className="text-2xl font-mono font-bold tracking-wider">
                  {redemptionResult.redemptionCode}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Show this code at the pickup location
                </p>
              </div>

              <p className="text-sm text-muted-foreground mt-4 text-center">
                You can view your redemption history in{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => {
                    closeDialog();
                    navigate("/rewards/my-redemptions");
                  }}
                >
                  My Redemptions
                </Button>
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={closeDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
