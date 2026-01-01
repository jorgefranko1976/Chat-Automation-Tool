import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Radio, Truck, Upload, Settings, FileCheck, Search, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/monitoring", label: "Monitoreo RNDC", icon: Radio },
    { href: "/tracking", label: "Reporte Tiempos", icon: Truck },
    { href: "/import", label: "Importar Excel", icon: Upload },
    { href: "/cumplidos", label: "Cumplidos", icon: FileCheck },
    { href: "/queries", label: "Consultas RNDC", icon: Search },
    { href: "/settings", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 mr-3">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <span className="font-display text-xl font-bold tracking-tight">RNDC Connect</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link key={link.href} href={link.href}>
                <a
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </a>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.name || user?.username || "Usuario"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {user?.email || user?.username}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          data-testid="button-sidebar-logout"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
