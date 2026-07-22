import { useState, useEffect } from "react";
import { Outlet, Navigate, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Heart,
  Trophy,
  Award,
  Gift,
  ShoppingCart,
  Star,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  PartyPopper,
  Swords,
  Target,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { isLoggedIn, getUser, useAuthStore } from "@/lib/auth-store";
import { cn, getInitials } from "@/lib/utils";
import { BackToDashboard } from "@/components/BackToDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/feed", label: "Feed", icon: MessageSquare },
    ],
  },
  {
    title: "Recognition",
    items: [
      { to: "/celebrations", label: "Celebrations", icon: PartyPopper },
      { to: "/kudos", label: "Kudos", icon: Heart },
      { to: "/nominations", label: "Nominations", icon: Star },
      { to: "/badges", label: "Badges", icon: Award },
    ],
  },
  {
    title: "Rewards",
    items: [
      { to: "/rewards", label: "Rewards", icon: Gift },
      { to: "/redemptions", label: "Redemptions", icon: ShoppingCart },
      { to: "/challenges", label: "Challenges", icon: Swords },
      { to: "/milestones", label: "Milestones", icon: Target },
    ],
  },
  {
    title: "Standings",
    items: [
      { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/budgets", label: "Budgets", icon: Wallet, adminOnly: true },
      { to: "/analytics", label: "Analytics", icon: BarChart3, adminOnly: true },
      { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
    ],
  },
];

type Role = "super_admin" | "org_admin" | "hr_admin" | "hr_manager" | "employee";
const ADMIN_ROLES: Role[] = ["super_admin", "org_admin", "hr_admin", "hr_manager"];

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true"
  );
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);

  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  const user = getUser();
  const displayName = user ? `${user.firstName} ${user.lastName}` : "User";
  const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    org_admin: "Org Admin",
    hr_admin: "HR Admin",
    hr_manager: "HR Manager",
    employee: "Employee",
  };
  const roleLabel = ROLE_LABELS[user?.role || "employee"] || "Employee";

  function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
    return (
      <div
        className={cn(
          "flex h-full flex-col bg-white border-r border-gray-200 transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center gap-3 border-b border-gray-100",
            collapsed ? "justify-center px-2" : "px-6"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-gray-900 truncate">EMP Rewards</span>
          )}
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
          {NAV_SECTIONS.map((section, si) => {
            const isAdmin = ADMIN_ROLES.includes((user?.role || "employee") as Role);
            const items = section.items.filter((item) => !item.adminOnly || isAdmin);
            if (items.length === 0) return null;
            return (
              <div key={section.title || si} className={si > 0 ? (collapsed ? "mt-3" : "mt-6") : ""}>
                {section.title &&
                  (collapsed ? (
                    si > 0 && <div className="mx-2 mb-2 border-t border-gray-100" />
                  ) : (
                    <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {section.title}
                    </p>
                  ))}
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center rounded-lg text-sm font-medium transition-colors",
                          collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User card */}
        <div className={cn("border-t border-gray-200", collapsed ? "p-2" : "p-4")}>
          {collapsed ? (
            <button
              onClick={logout}
              title={`${displayName} — Sign out`}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold hover:bg-brand-200"
            >
              {getInitials(displayName)}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
                {getInitials(displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="relative hidden lg:block">
        <SidebarContent collapsed={collapsed} />
        {/* Collapse / expand toggle on the sidebar edge */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-20 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Mobile sidebar overlay (always full width) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 z-50 h-full">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <BackToDashboard />
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
              {getInitials(displayName)}
            </div>
            <span className="hidden md:block text-sm font-medium text-gray-700">{displayName}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
