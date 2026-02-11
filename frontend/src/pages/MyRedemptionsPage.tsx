import { useState, useEffect } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Package,
  Ticket,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { uploadService } from "../services/upload";

interface Redemption {
  id: number;
  pointsSpent: number;
  redemptionCode: string;
  status: string;
  collectedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  reward: {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    category: string;
    pointsCost: number;
  };
}

export default function MyRedemptionsPage() {
  const navigate = useNavigate();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const fetchRedemptions = async () => {
    try {
      const data = await api.get<Redemption[]>("/rewards/my-redemptions");
      setRedemptions(data);
    } catch (err) {
      console.error("Failed to fetch redemptions:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="warning">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "collected":
        return (
          <Badge variant="success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Collected
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rewards")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">My Redemptions</h1>
          <p className="text-muted-foreground">Your redemption history</p>
        </div>
      </div>

      {/* Redemptions List */}
      {redemptions.length === 0 ? (
        <Card className="p-8 text-center max-w-md mx-auto">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground mb-4">No redemptions yet</p>
          <Button onClick={() => navigate("/rewards")}>Browse Rewards</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {redemptions.map((redemption) => (
            <Card key={redemption.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Reward Image */}
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {redemption.reward.imageUrl ? (
                      <img
                        src={uploadService.getImageUrl(redemption.reward.imageUrl)}
                        alt={redemption.reward.name}
                        className="w-full h-full object-cover"
                      />
                    ) : redemption.reward.category === "physical" ? (
                      <Package className="h-7 w-7 text-muted-foreground" />
                    ) : (
                      <Ticket className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-lg">{redemption.reward.name}</h3>
                      {getStatusBadge(redemption.status)}
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {redemption.pointsSpent.toLocaleString()} points
                    </p>
                  </div>
                </div>

                {/* Redemption Code */}
                <div className="mt-4 bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Redemption Code
                      </p>
                      <p className="font-mono font-bold text-xl">
                        {redemption.redemptionCode}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(redemption.redemptionCode)}
                    >
                      {copiedCode === redemption.redemptionCode ? (
                        <>
                          <Check className="h-4 w-4 text-green-600 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Dates */}
                <div className="mt-4 text-sm text-muted-foreground space-y-1 border-t pt-4">
                  <p>Redeemed: {formatDate(redemption.createdAt)}</p>
                  {redemption.status === "pending" && redemption.expiresAt && (
                    <p>
                      Expires:{" "}
                      {formatDate(redemption.expiresAt)}
                    </p>
                  )}
                  {redemption.status === "collected" && redemption.collectedAt && (
                    <p>
                      Collected:{" "}
                      {formatDate(redemption.collectedAt)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
