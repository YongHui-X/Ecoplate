import { Home, Refrigerator, ShoppingBag, Coffee, MessageCircle, BarChart3, Award } from "lucide-react";

interface SidebarProps {
  activePage?: string;
}

export function Sidebar({ activePage = "ecoboard" }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "myfridge", label: "MyFridge", icon: Refrigerator },
    { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
    { id: "vending", label: "Vending", icon: Coffee },
    { id: "messages", label: "Messages", icon: MessageCircle },
    { id: "ecoboard", label: "EcoBoard", icon: BarChart3 },
    { id: "badges", label: "Badges", icon: Award },
  ];

  return (
    <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 h-screen flex-col">
      {/* Logo */}
      <div className="p-6">
        <h1 className="text-2xl font-bold text-green-600">EcoPlate</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activePage;

          return (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                isActive
                  ? "bg-green-50 text-green-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}