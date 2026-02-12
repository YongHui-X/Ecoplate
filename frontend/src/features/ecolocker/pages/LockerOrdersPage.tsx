import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  MapPin,
  Clock,
  ChevronRight,
  Loader2,
  ShoppingBag,
  Store,
  RefreshCw,
} from "lucide-react";
import { orderApi } from "../services/locker-api";
import { useToast } from "@/contexts/ToastContext";
import { getErrorMessage } from "../utils/network";
import type { LockerOrder } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDateTime } from "@/lib/utils";
import LockerTabs from "../components/LockerTabs";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
> = {
  pending_payment: { label: "Awaiting Payment", variant: "warning" },
  paid: { label: "Paid", variant: "default" },
  pickup_scheduled: { label: "Pickup Scheduled", variant: "secondary" },
  in_transit: { label: "In Transit", variant: "secondary" },
  ready_for_pickup: { label: "Ready for Pickup", variant: "success" },
  collected: { label: "Collected", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
};

export default function LockerOrdersPage() {
  const [activeTab, setActiveTab] = useState<"buyer" | "seller">("buyer");
  const [buyerOrders, setBuyerOrders] = useState<LockerOrder[]>([]);
  const [sellerOrders, setSellerOrders] = useState<LockerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const [buyer, seller] = await Promise.all([
        orderApi.getBuyerOrders(),
        orderApi.getSellerOrders(),
      ]);
      setBuyerOrders(buyer);
      setSellerOrders(seller);
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const orders = activeTab === "buyer" ? buyerOrders : sellerOrders;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <LockerTabs />

      <div className="p-4">

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === "buyer" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("buyer")}
          className="flex-1"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Buying ({buyerOrders.length})
        </Button>
        <Button
          variant={activeTab === "seller" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("seller")}
          className="flex-1"
        >
          <Store className="h-4 w-4 mr-2" />
          Selling ({sellerOrders.length})
        </Button>
      </div>

      {/* Retry button if failed to load */}
      {!loading && buyerOrders.length === 0 && sellerOrders.length === 0 && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={loadOrders} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Orders
          </Button>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No orders yet</p>
          <p className="text-sm text-muted-foreground">
            {activeTab === "buyer"
              ? "Orders you purchase will appear here"
              : "Orders for your listings will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} isSeller={activeTab === "seller"} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isSeller,
}: {
  order: LockerOrder;
  isSeller: boolean;
}) {
  const status = statusConfig[order.status] || {
    label: order.status,
    variant: "default" as const,
  };

  return (
    <Link to={`/ecolocker/orders/${order.id}`}>
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">
                  {order.listing?.title || `Order #${order.id}`}
                </h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{order.locker?.name}</span>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="font-medium">
                  {formatPrice(order.totalPrice)}
                </span>
                <span className="text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatDateTime(order.reservedAt)}
                </span>
              </div>

              {isSeller && order.buyer && (
                <p className="text-sm text-muted-foreground mt-1">
                  Buyer: {order.buyer.name}
                </p>
              )}

              {!isSeller && order.seller && (
                <p className="text-sm text-muted-foreground mt-1">
                  Seller: {order.seller.name}
                </p>
              )}
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
