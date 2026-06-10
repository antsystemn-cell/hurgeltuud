import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import {
  Package,
  Truck,
  Users,
  Settings,
  BarChart3,
  PlusCircle,
  Printer,
  LogOut,
  Menu,
  X,
  Globe,
  ClipboardList,
  Home,
  Smartphone,
  Wallet,
  Link2,
  WifiOff,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const navByRole: Record<string, NavItem[]> = {
  driver: [
    { label: "Миний хүргэлтүүд", path: "/driver", icon: <Truck className="h-5 w-5" /> },
    { label: "Хэтэвч", path: "/driver/wallet", icon: <Wallet className="h-5 w-5" /> },
  ],
  operator: [
    { label: "Идэвхтэй", path: "/operator", icon: <ClipboardList className="h-5 w-5" /> },
    { label: "Бүх захиалга", path: "/operator/orders", icon: <Package className="h-5 w-5" /> },
    { label: "Шинэ захиалга", path: "/operator/create", icon: <PlusCircle className="h-5 w-5" /> },
    { label: "Хэвлэх", path: "/operator/print", icon: <Printer className="h-5 w-5" /> },
  ],
  main_admin: [
    { label: "Хянах самбар", path: "/admin", icon: <Home className="h-5 w-5" /> },
    { label: "Захиалгууд", path: "/admin/orders", icon: <Package className="h-5 w-5" /> },
    { label: "Шинэ захиалга", path: "/admin/create", icon: <PlusCircle className="h-5 w-5" /> },
    { label: "Жолооч", path: "/admin/drivers", icon: <Truck className="h-5 w-5" /> },
    { label: "Хэрэглэгчид", path: "/admin/users", icon: <Users className="h-5 w-5" /> },
    { label: "Эх сайтууд", path: "/admin/sources", icon: <Globe className="h-5 w-5" /> },
    { label: "Only Hub холболт", path: "/admin/only-hub", icon: <Link2 className="h-5 w-5" /> },
    { label: "Тайлан", path: "/admin/reports", icon: <BarChart3 className="h-5 w-5" /> },
    { label: "Хэвлэх", path: "/admin/print", icon: <Printer className="h-5 w-5" /> },
    { label: "Тохиргоо", path: "/admin/settings", icon: <Settings className="h-5 w-5" /> },
    { label: "PWA тохиргоо", path: "/admin/pwa", icon: <Smartphone className="h-5 w-5" /> },
    { label: "Хэтэвч удирдлага", path: "/admin/wallet", icon: <Wallet className="h-5 w-5" /> },
  ],
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = role ? navByRole[role] || [] : [];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 flex-col border-r border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img src={logo} alt="ON Shop" className="h-9 w-9" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">ON Shop</h1>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
            Гарах
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <img src={logo} alt="ON Shop" className="h-8 w-8" />
            <h1 className="text-lg font-semibold text-foreground">ON Shop</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-background">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <img src={logo} alt="ON Shop" className="h-8 w-8" />
                <h1 className="text-lg font-semibold text-foreground">ON Shop</h1>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="p-4 space-y-1">
              {items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-base transition-colors",
                    location.pathname === item.path
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base text-muted-foreground hover:bg-accent w-full"
              >
                <LogOut className="h-5 w-5" />
                Гарах
              </button>
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
