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
  Package,
  Ticket,
  Loader2,
  CheckCircle,
  AlertCircle,
  History,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [filter, setFilter] = useState<"all" | "physical" | "voucher">("all");

  useEffect(() => {
    fetchRewardsAndBalance();
  }, []);

  const fetchRewardsAndBalance = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const [rewardsRes, balanceRes] = await Promise.all([
        fetch("/api/v1/rewards", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/v1/rewards/balance", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewards(data);
      }

      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data.balance);
      }
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
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/rewards/redeem", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rewardId: selectedReward.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to redeem reward");
        return;
      }

      setRedemptionResult(data);
      setBalance((prev) => prev - selectedReward.pointsCost);

      setRewards((prev) =>
        prev.map((r) =>
          r.id === selectedReward.id ? { ...r, stock: r.stock - 1 } : r
        )
      );
    } catch (err) {
      setError("Failed to redeem reward. Please try again.");
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
    return category === "physical" ? (
      <Package className="h-4 w-4" />
    ) : (
      <Ticket className="h-4 w-4" />
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
    <div className="container max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="text-muted-foreground">Redeem your EcoPoints for rewards</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/rewards/my-redemptions")}
        >
          <History className="h-4 w-4 mr-2" />
          My Redemptions
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="p-4 mb-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Your Balance</p>
            <div className="flex items-center gap-2">
              <Coins className="h-6 w-6" />
              <span className="text-3xl font-bold">{balance.toLocaleString()}</span>
              <span className="text-lg">points</span>
            </div>
          </div>
          <Gift className="h-12 w-12 opacity-50" />
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "physical" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("physical")}
        >
          <Package className="h-4 w-4 mr-1" />
          Physical
        </Button>
        <Button
          variant={filter === "voucher" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("voucher")}
        >
          <Ticket className="h-4 w-4 mr-1" />
          Vouchers
        </Button>
      </div>

      {/* Rewards Grid */}
      {filteredRewards.length === 0 ? (
        <Card className="p-8 text-center">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No rewards available</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredRewards.map((reward) => (
            <Card
              key={reward.id}
              className={`overflow-hidden ${
                reward.stock === 0 ? "opacity-60" : ""
              }`}
            >
              {/* Image */}
              <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
                {reward.imageUrl ? (
                  <img
                    src={reward.imageUrl}
                    alt={reward.name}
                    className="w-full h-full object-contain bg-white"
                  />
                ) : reward.category === "physical" ? (
                  <Package className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <Ticket className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{reward.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryIcon(reward.category)}
                    <span className="ml-1">
                      {reward.category === "physical" ? "Physical" : "Voucher"}
                    </span>
                  </Badge>
                </div>

                {reward.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {reward.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-primary font-semibold">
                    <Coins className="h-4 w-4" />
                    <span>{reward.pointsCost.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Stock: {reward.stock}
                    </span>
                    <Button
                      size="sm"
                      disabled={reward.stock === 0 || balance < reward.pointsCost}
                      onClick={() => setSelectedReward(reward)}
                    >
                      {reward.stock === 0
                        ? "Out of Stock"
                        : balance < reward.pointsCost
                        ? "Not Enough Points"
                        : "Redeem"}
                    </Button>
                  </div>
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
