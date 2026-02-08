import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/utils/network";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-14 left-0 right-0 z-40 bg-warning px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-warning-foreground safe-area-top">
      <WifiOff className="h-4 w-4" />
      <span>You're offline. Some features may be unavailable.</span>
    </div>
  );
}
