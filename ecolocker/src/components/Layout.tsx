import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  MapPin,
  Package,
  Bell,
  LogOut,
  User,
  Home,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { OfflineBanner } from "./OfflineBanner";
import { getEcoPlateUrl } from "../services/navigation";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: MapPin, label: "Lockers" },
    { path: "/orders", icon: Package, label: "Orders" },
    { path: "/notifications", icon: Bell, label: "Alerts" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">EcoLocker</span>
          </Link>

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {user.name}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content - add padding for safe areas and keyboard */}
      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)]" style={{ paddingBottom: `calc(var(--keyboard-height, 0px) + env(safe-area-inset-bottom, 0px) + 5rem)` }}>
        {children}
      </main>

      {/* Bottom navigation */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 pb-[env(safe-area-inset-bottom,0px)] z-50">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => {
                window.location.href = getEcoPlateUrl();
              }}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium">EcoPlate</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
