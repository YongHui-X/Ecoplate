import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Home,
  Refrigerator,
  Store,
  MessageCircle,
  Trophy,
  Award,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/myfridge", icon: Refrigerator, label: "MyFridge" },
  { to: "/marketplace", icon: Store, label: "Marketplace" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/ecoboard", icon: Trophy, label: "EcoBoard" },
  { to: "/badges", icon: Award, label: "Badges" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">EcoPlate</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-50 bg-white">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-gray-100"
                  )
                }
                end={item.to === "/"}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
            <div className="border-t pt-2 mt-2">
              <NavLink
                to="/account"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  )
                }
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
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
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">View Profile</p>
                </div>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 w-full"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-white border-r">
          <div className="p-6">
            <span className="text-2xl font-bold text-primary">EcoPlate</span>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-gray-100"
                  )
                }
                end={item.to === "/"}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t space-y-2">
            <NavLink
              to="/account"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-2 rounded-lg text-sm",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )
              }
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
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
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg w-full"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
