import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { isLoggedIn, useAuthStore, extractSSOToken } from "@/lib/auth-store";
import { apiPost } from "@/api/client";

// Layouts (eagerly loaded)
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Lazy-loaded pages
const LoginPage = lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);

// Feed
const FeedPage = lazy(() =>
  import("@/pages/feed/FeedPage").then((m) => ({ default: m.FeedPage })),
);

// Kudos
const SendKudosPage = lazy(() =>
  import("@/pages/kudos/SendKudosPage").then((m) => ({ default: m.SendKudosPage })),
);
const KudosDetailPage = lazy(() =>
  import("@/pages/kudos/KudosDetailPage").then((m) => ({ default: m.KudosDetailPage })),
);
const MyKudosPage = lazy(() =>
  import("@/pages/kudos/MyKudosPage").then((m) => ({ default: m.MyKudosPage })),
);

// Leaderboard
const LeaderboardPage = lazy(() =>
  import("@/pages/leaderboard/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })),
);

// Badges
const BadgeListPage = lazy(() =>
  import("@/pages/badges/BadgeListPage").then((m) => ({ default: m.BadgeListPage })),
);
const BadgeDetailPage = lazy(() =>
  import("@/pages/badges/BadgeDetailPage").then((m) => ({ default: m.BadgeDetailPage })),
);
const MyBadgesPage = lazy(() =>
  import("@/pages/badges/MyBadgesPage").then((m) => ({ default: m.MyBadgesPage })),
);

// Rewards
const RewardCatalogPage = lazy(() =>
  import("@/pages/rewards/RewardCatalogPage").then((m) => ({ default: m.RewardCatalogPage })),
);
const RewardDetailPage = lazy(() =>
  import("@/pages/rewards/RewardDetailPage").then((m) => ({ default: m.RewardDetailPage })),
);

// Redemptions
const RedemptionListPage = lazy(() =>
  import("@/pages/redemptions/RedemptionListPage").then((m) => ({ default: m.RedemptionListPage })),
);
const RedemptionDetailPage = lazy(() =>
  import("@/pages/redemptions/RedemptionDetailPage").then((m) => ({ default: m.RedemptionDetailPage })),
);

// Nominations
const NominationProgramsPage = lazy(() =>
  import("@/pages/nominations/NominationProgramsPage").then((m) => ({ default: m.NominationProgramsPage })),
);
const NominationSubmitPage = lazy(() =>
  import("@/pages/nominations/NominationSubmitPage").then((m) => ({ default: m.NominationSubmitPage })),
);
const NominationListPage = lazy(() =>
  import("@/pages/nominations/NominationListPage").then((m) => ({ default: m.NominationListPage })),
);

// Budgets
const BudgetListPage = lazy(() =>
  import("@/pages/budgets/BudgetListPage").then((m) => ({ default: m.BudgetListPage })),
);

// Analytics
const AnalyticsPage = lazy(() =>
  import("@/pages/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);

// Settings
const SettingsPage = lazy(() =>
  import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function AuthRedirect() {
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function SSOGate({ children }: { children: React.ReactNode }) {
  const login = useAuthStore((s) => s.login);
  const [ssoToken] = useState(() => extractSSOToken());
  const [ready, setReady] = useState(!ssoToken); // ready immediately if no SSO token
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ssoToken) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await apiPost<{
          user: any;
          tokens: { accessToken: string; refreshToken: string };
        }>("/auth/sso", { token: ssoToken });

        if (cancelled) return;

        const { user, tokens } = res.data!;
        login(user, tokens);

        // Redirect to dashboard after SSO login
        if (window.location.pathname === "/" || window.location.pathname === "/login") {
          window.location.replace("/dashboard");
          return; // Page is redirecting, don't setReady
        }
        setReady(true);
      } catch (err: any) {
        if (cancelled) return;
        console.error("SSO exchange failed:", err);
        setError("SSO login failed. Please try logging in manually.");
        setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [ssoToken, login]);

  if (!ready) return <PageLoader />;
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/login" className="text-brand-600 underline">Go to login</a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <SSOGate>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root redirect */}
        <Route path="/" element={<AuthRedirect />} />

        {/* Protected routes inside DashboardLayout */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Feed */}
          <Route path="/feed" element={<FeedPage />} />

          {/* Kudos */}
          <Route path="/kudos" element={<MyKudosPage />} />
          <Route path="/kudos/send" element={<SendKudosPage />} />
          <Route path="/kudos/:id" element={<KudosDetailPage />} />

          {/* Leaderboard */}
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          {/* Badges */}
          <Route path="/badges" element={<BadgeListPage />} />
          <Route path="/badges/mine" element={<MyBadgesPage />} />
          <Route path="/badges/:id" element={<BadgeDetailPage />} />

          {/* Rewards */}
          <Route path="/rewards" element={<RewardCatalogPage />} />
          <Route path="/rewards/:id" element={<RewardDetailPage />} />

          {/* Redemptions */}
          <Route path="/redemptions" element={<RedemptionListPage />} />
          <Route path="/redemptions/:id" element={<RedemptionDetailPage />} />

          {/* Nominations */}
          <Route path="/nominations" element={<NominationProgramsPage />} />
          <Route path="/nominations/submit" element={<NominationSubmitPage />} />
          <Route path="/nominations/list" element={<NominationListPage />} />

          {/* Budgets */}
          <Route path="/budgets" element={<BudgetListPage />} />

          {/* Analytics */}
          <Route path="/analytics" element={<AnalyticsPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<div className="p-8"><h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1></div>} />
      </Routes>
    </Suspense>
    </SSOGate>
  );
}
