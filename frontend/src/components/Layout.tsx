import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnreadCount } from "../contexts/UnreadCountContext";
import {
  Home,
  Refrigerator,
  Store,
  MessageCircle,
  Trophy,
  Award,
  LogOut,
  User,
} from "lucide-react";
import { cn } from "../lib/utils";

// Desktop sidebar items (full list)
const sidebarItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  // { to: "/myfridge", icon: Refrigerator, label: "MyFridge" },
  { to: "/marketplace", icon: Store, label: "Marketplace" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/ecoboard", icon: Trophy, label: "EcoBoard" },
  { to: "/badges", icon: Award, label: "Badges" },
];

// Mobile bottom tab items (5 main tabs)
const mobileTabItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/myfridge", icon: Refrigerator, label: "Fridge" },
  { to: "/marketplace", icon: Store, label: "Market" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/account", icon: User, label: "Account" },
];

// Helper to get page title from path
function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/myfridge")) return "MyFridge";
  if (pathname.startsWith("/marketplace")) return "Marketplace";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/ecopoints")) return "Eco Points";
  if (pathname.startsWith("/ecoboard")) return "EcoBoard";
  if (pathname.startsWith("/badges")) return "Badges";
  if (pathname.startsWith("/account")) return "Account";
  return "EcoPlate";
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useUnreadCount();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header - simplified, no hamburger */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b px-4 py-3 safe-area-top">
        <div className="flex items-center justify-center">
          <span className="text-lg font-semibold text-foreground">{pageTitle}</span>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar - fixed position */}
        <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r fixed top-0 left-0 z-30">
          <div className="p-6">
            <span className="text-2xl font-bold text-primary">EcoPlate</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {sidebarItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "hover:bg-muted"
                  )
                }
                end={item.to === "/"}
              >
                <item.icon size={20} />
                {item.label}
                {item.to === "/messages" && unreadCount > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t space-y-2">
            <NavLink
              to="/account"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                )
              }
            >
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-lg">
                {user?.avatarUrl && user.avatarUrl.startsWith('avatar')
                  ? (() => {
                      const avatarMap: Record<string, string> = {
                        'avatar1': '🌱',
                        'avatar2': '🌿',
                        'avatar3': '🍃',
                        'avatar4': '🌾',
                        'avatar5': '🥬',
                        'avatar6': '🥕',
                        'avatar7': '🍎',
                        'avatar8': '🥑',
                      };
                      return avatarMap[user.avatarUrl] || user.name.charAt(0).toUpperCase();
                    })()
                  : user?.name.charAt(0).toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted rounded-xl w-full transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content - adjusted for mobile header and bottom tabs, with left margin for fixed sidebar */}
        <main className="flex-1 min-h-screen lg:ml-64">
          <div className="pt-14 pb-20 lg:pt-8 lg:pb-8 p-4 lg:px-10 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom tab navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {mobileTabItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )
              }
              end={item.to === "/"}
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />
                  )}
                  <span className="relative">
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    {item.to === "/messages" && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-[16px] flex items-center justify-center rounded-full px-1">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "text-[10px] mt-1 font-medium",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
