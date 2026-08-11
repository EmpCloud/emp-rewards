import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Trophy, Eye, EyeOff, Loader2, Clock } from "lucide-react";
import { useLogin } from "@/api/hooks";
import { useAuthStore } from "@/lib/auth-store";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const FEATURES = [
  "Kudos",
  "Badges & awards",
  "Leaderboards",
  "Point system",
  "Nominations",
  "Gift cards",
  "Recognition wall",
  "Analytics",
];

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("session") === "expired";
  const loginMutation = useLogin();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await loginMutation.mutateAsync({ email, password });
      if (res.success) {
        login(res.data.user, res.data.tokens);
        toast.success(`${tr("Welcome back")}, ${res.data.user.firstName}!`);
        navigate("/dashboard");
      } else {
        toast.error(tr(res.error?.message || "Login failed"));
      }
    } catch (err: any) {
      toast.error(tr(err.response?.data?.error?.message || "Login failed. Check your credentials."));
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="absolute right-4 top-4 z-20 rounded-lg border border-gray-200 bg-white shadow-sm"><LanguageSwitcher /></div>
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 p-12">
        <div className="max-w-md text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold">{tr("EMP Rewards")}</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight">

            {tr("Recognize and reward your team")}
          </h1>
          <p className="mt-4 text-lg text-brand-100">

            {tr("Send kudos, award badges, track points, run nominations, and celebrate wins — all in one place.")}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-brand-300" />
                <span className="text-sm text-brand-100">{tr(feature)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">{tr("EMP Rewards")}</span>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">{tr("Welcome back")}</h2>
            <p className="mt-1 text-sm text-gray-500">{tr("Sign in to recognize your team")}</p>

            {sessionExpired && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{tr("Your session has expired")}</p>
                  <p className="mt-0.5 text-amber-700">{tr("Please sign in again to continue.")}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">

                  {tr("Email address")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">

                  {tr("Password")}
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />

                    {tr("Signing in...")}
                  </>
                ) : (
                  tr("Sign in")
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
