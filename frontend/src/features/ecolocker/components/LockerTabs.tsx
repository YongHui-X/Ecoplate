import { Link, useLocation } from "react-router-dom";
import { MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LockerTabs() {
  const { pathname } = useLocation();
  const isOrders = pathname.startsWith("/ecolocker/orders");

  return (
    <div className="flex gap-2 p-4 pb-0">
      <Button
        variant={!isOrders ? "default" : "outline"}
        size="sm"
        className="flex-1"
        asChild
      >
        <Link to="/ecolocker">
          <MapPin className="h-4 w-4 mr-2" />
          Lockers
        </Link>
      </Button>
      <Button
        variant={isOrders ? "default" : "outline"}
        size="sm"
        className="flex-1"
        asChild
      >
        <Link to="/ecolocker/orders">
          <Package className="h-4 w-4 mr-2" />
          Orders
        </Link>
      </Button>
    </div>
  );
}
