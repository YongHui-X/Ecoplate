import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CreditCard,
  MapPin,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { orderApi } from "../services/locker-api";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage } from "../utils/network";
import type { LockerOrder } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { formatPrice, formatCountdown } from "@/lib/utils";

export function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [order, setOrder] = useState<LockerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (orderId) {
      loadOrder(parseInt(orderId, 10));
    }
  }, [orderId]);

  useEffect(() => {
    if (order?.paymentDeadline) {
      const interval = setInterval(() => {
        const deadline = new Date(order.paymentDeadline!);
        setCountdown(formatCountdown(deadline));

        if (new Date() > deadline) {
          clearInterval(interval);
          addToast("Payment deadline has expired. Order has been cancelled.", "error");
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [order?.paymentDeadline, addToast]);

  async function loadOrder(id: number) {
    try {
      setLoading(true);
      const data = await orderApi.getById(id);
      setOrder(data);

      if (data.status !== "pending_payment") {
        navigate(`/orders/${id}`);
      }
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    if (!order) return;

    setProcessing(true);

    try {
      await orderApi.pay(order.id);
      addToast("Payment successful!", "success");
      navigate(`/orders/${order.id}?paid=true`);
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    if (!order) return;

    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
      await orderApi.cancel(order.id, "Cancelled by buyer");
      addToast("Order cancelled", "info");
      navigate("/orders");
    } catch (err) {
      addToast(getErrorMessage(err), "error");
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

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-4">Complete Payment</h1>

      {/* Countdown */}
      <Card className="mb-4 border-warning bg-warning/10">
        <CardContent className="flex items-center gap-3 py-4">
          <Clock className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium">Payment Deadline</p>
            <p className="text-lg font-bold">{countdown}</p>
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
            </div>
          </div>

          {/* Price breakdown */}
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
        </CardContent>
      </Card>

      {/* Payment simulation */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This is a simulated payment. Click the button below to complete the
            order.
          </p>
          <div className="bg-muted rounded-xl p-4 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
            <p className="text-sm">Payment simulation ready</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pay {formatPrice(order.totalPrice)}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCancel}
          disabled={processing}
        >
          Cancel Order
        </Button>
      </div>
    </div>
  );
}
