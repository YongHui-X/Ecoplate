import { Home, Refrigerator, ShoppingBag, Coffee, BarChart3 } from "lucide-react";

interface MobileNavProps {
  activePage?: string;
}

export function MobileNav({ activePage = "ecoboard" }: MobileNavProps) {
  const navItems = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "myfridge", label: "Fridge", icon: Refrigerator },
    { id: "marketplace", label: "Market", icon: ShoppingBag },
    { id: "vending", label: "Vending", icon: Coffee },
    { id: "ecoboard", label: "EcoBoard", icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activePage;

          return (
            <button
              key={item.id}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "text-green-600"
                  : "text-gray-500"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "fill-green-100" : ""}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
