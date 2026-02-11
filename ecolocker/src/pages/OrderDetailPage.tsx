import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Package,
  MapPin,
  Clock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Key,
  Calendar,
  Truck,
} from "lucide-react";
import { orderApi } from "../services/locker-api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage } from "../utils/network";
import type { LockerOrder } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatPrice, formatDateTime } from "@/lib/utils";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive"; icon: typeof Package }
> = {
  pending_payment: { label: "Awaiting Payment", variant: "warning", icon: Clock },
  paid: { label: "Paid - Awaiting Seller", variant: "default", icon: CheckCircle2 },
  pickup_scheduled: { label: "Pickup Scheduled", variant: "secondary", icon: Calendar },
  in_transit: { label: "In Transit", variant: "secondary", icon: Truck },
  ready_for_pickup: { label: "Ready for Pickup", variant: "success", icon: Key },
  collected: { label: "Collected", variant: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
  expired: { label: "Expired", variant: "destructive", icon: AlertCircle },
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [order, setOrder] = useState<LockerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // For seller scheduling
  const [pickupTime, setPickupTime] = useState("");

  const justPaid = searchParams.get("paid") === "true";

  useEffect(() => {
    if (orderId) {
      loadOrder(parseInt(orderId, 10));
    }
  }, [orderId]);

  async function loadOrder(id: number) {
    try {
      setLoading(true);
      const data = await orderApi.getById(id);
      setOrder(data);
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const isBuyer = user?.id === order?.buyerId;
  const isSeller = user?.id === order?.sellerId;

  async function handleSchedulePickup() {
    if (!order || !pickupTime) return;

    setActionLoading(true);

    try {
      const updatedOrder = await orderApi.schedule(order.id, new Date(pickupTime).toISOString());
      setOrder(updatedOrder);
      addToast("Pickup scheduled successfully", "success");
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmRiderPickup() {
    if (!order) return;

    setActionLoading(true);

    try {
      const updatedOrder = await orderApi.confirmRiderPickup(order.id);
      setOrder(updatedOrder);
      addToast("Pickup confirmed! Rider is on the way.", "success");
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;

    setActionLoading(true);

    try {
      const reason = isBuyer ? "Cancelled by buyer" : "Cancelled by seller";
      const updatedOrder = await orderApi.cancel(order.id, reason);
      setOrder(updatedOrder);
      addToast("Order cancelled", "info");
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <p className="text-lg font-medium">Order not found</p>
        <Button onClick={() => navigate("/orders")} className="mt-4">
          View Orders
        </Button>
      </div>
    );
  }

  const status = statusConfig[order.status] || {
    label: order.status,
    variant: "default" as const,
    icon: Package,
  };
  const StatusIcon = status.icon;

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate("/orders")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </button>

      {justPaid && (
        <div className="p-4 rounded-xl bg-success/10 text-success mb-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Payment Successful!</p>
            <p className="text-sm">
              The seller has been notified and will schedule a pickup time for the delivery rider.
            </p>
          </div>
        </div>
      )}

      {/* Status */}
      <Card className="mb-4">
        <CardContent className="flex items-center gap-4 py-6">
          <div className={`p-3 rounded-full bg-${status.variant}/10`}>
            <StatusIcon className={`h-6 w-6 text-${status.variant}`} />
          </div>
          <div>
            <Badge variant={status.variant} className="mb-1">
              {status.label}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Order #{order.id}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Order details */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Item */}
          <div>
            <h3 className="font-medium">{order.listing?.title}</h3>
            <p className="text-sm text-muted-foreground">
              {order.listing?.description}
            </p>
          </div>

          {/* Locker */}
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">{order.locker?.name}</p>
              <p className="text-sm text-muted-foreground">
                {order.locker?.address}
              </p>
              {order.compartmentNumber && (
                <p className="text-sm font-medium mt-1">
                  Compartment #{order.compartmentNumber}
                </p>
              )}
            </div>
          </div>

          {/* Participants */}
          {isBuyer && order.seller && (
            <div className="text-sm">
              <span className="text-muted-foreground">Seller: </span>
              <span className="font-medium">{order.seller.name}</span>
            </div>
          )}
          {isSeller && order.buyer && (
            <div className="text-sm">
              <span className="text-muted-foreground">Buyer: </span>
              <span className="font-medium">{order.buyer.name}</span>
            </div>
          )}

          {/* Price */}
          <div className="border-t border-border pt-4">
            <div className="flex justify-between text-sm">
              <span>Item Price</span>
              <span>{formatPrice(order.itemPrice)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Delivery Fee</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg mt-2 pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatPrice(order.totalPrice)}</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-sm text-muted-foreground space-y-1">
            {order.reservedAt && (
              <p>Reserved: {formatDateTime(order.reservedAt)}</p>
            )}
            {order.paidAt && <p>Paid: {formatDateTime(order.paidAt)}</p>}
            {order.pickupScheduledAt && (
              <p>Scheduled: {formatDateTime(order.pickupScheduledAt)}</p>
            )}
            {order.riderPickedUpAt && (
              <p>Rider picked up: {formatDateTime(order.riderPickedUpAt)}</p>
            )}
            {order.deliveredAt && (
              <p>Ready: {formatDateTime(order.deliveredAt)}</p>
            )}
            {order.pickedUpAt && (
              <p>Collected: {formatDateTime(order.pickedUpAt)}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions based on status and role */}

      {/* Seller: Schedule pickup when paid */}
      {isSeller && order.status === "paid" && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Schedule Pickup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When should the delivery rider pick up the item from you?
            </p>
            <Input
              type="datetime-local"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <Button
              className="w-full"
              onClick={handleSchedulePickup}
              disabled={actionLoading || !pickupTime}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Schedule Pickup
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Seller: Confirm rider pickup */}
      {isSeller && (order.status === "paid" || order.status === "pickup_scheduled") && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Confirm Rider Pickup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Click below after the delivery rider has collected the item from you.
            </p>
            <Button
              className="w-full"
              onClick={handleConfirmRiderPickup}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  Rider Has Picked Up
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Buyer: Show PIN when ready for pickup */}
      {isBuyer && order.status === "ready_for_pickup" && (
        <Card className="mb-4 border-success">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-success" />
              Your Pickup PIN
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Show this PIN at the locker to unlock your compartment.
            </p>
            <div className="text-center text-4xl font-mono font-bold tracking-[0.5em] py-4">
              {order.pickupPin}
            </div>
            {order.compartmentNumber && (
              <p className="text-center text-sm text-muted-foreground">
                Compartment #{order.compartmentNumber} at {order.locker?.name}
              </p>
            )}
            {order.expiresAt && (
              <p className="text-center text-xs text-muted-foreground">
                PIN expires: {formatDateTime(order.expiresAt)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel button (for active orders) */}
      {["pending_payment", "paid", "pickup_scheduled", "in_transit", "ready_for_pickup"].includes(
        order.status
      ) && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCancel}
          disabled={actionLoading}
        >
          Cancel Order
        </Button>
      )}

      {/* Completed message */}
      {order.status === "collected" && (
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-success/10 text-success text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3" />
            <p className="font-semibold text-lg">Order Complete!</p>
            <p className="text-sm mt-1">Thank you for using EcoLocker.</p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/orders")}
          >
            <Package className="h-4 w-4 mr-2" />
            View All Orders
          </Button>
        </div>
      )}
    </div>
  );
}
