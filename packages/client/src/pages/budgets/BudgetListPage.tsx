import { useState, useEffect } from "react";
import { Wallet, Plus, X, ChevronDown, DollarSign, TrendingUp } from "lucide-react";
import { apiGet, apiPost } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import toast from "react-hot-toast";

interface Budget {
  id: string;
  budget_type: string;
  owner_id: number;
  department_id: number | null;
  period: string;
  total_amount: number;
  spent_amount: number;
  remaining_amount: number;
  period_start: string;
  period_end: string;
  is_active: boolean;
  created_at: string;
}

interface BudgetListData {
  data: Budget[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function ProgressBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500">{pct}% used</span>
        <span className="font-medium text-gray-700">{spent.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BudgetCard({ budget }: { budget: Budget }) {
  const remaining = Number(budget.remaining_amount);
  const spent = Number(budget.spent_amount);
  const total = Number(budget.total_amount);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${budget.budget_type === "manager" ? "bg-amber-100" : "bg-orange-100"}`}>
            <Wallet className={`h-4 w-4 ${budget.budget_type === "manager" ? "text-amber-600" : "text-orange-600"}`} />
          </div>
          <div>
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
              {budget.budget_type}
            </span>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${budget.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {budget.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900">{total.toLocaleString()}</p>
          <p className="text-[10px] uppercase text-gray-500">Allocated</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-700">{spent.toLocaleString()}</p>
          <p className="text-[10px] uppercase text-gray-500">Spent</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-700">{remaining.toLocaleString()}</p>
          <p className="text-[10px] uppercase text-gray-500">Remaining</p>
        </div>
      </div>

      <ProgressBar spent={spent} total={total} />

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span className="capitalize">{budget.period}</span>
        <span>{budget.period_start} to {budget.period_end}</span>
      </div>
    </div>
  );
}

export function BudgetListPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user && ["org_admin", "hr_admin", "hr_manager"].includes(user.role);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    budget_type: "manager" as "manager" | "department",
    owner_id: user?.empcloudUserId || 0,
    department_id: "",
    period: "monthly" as "monthly" | "quarterly" | "annual",
    total_amount: "",
    period_start: "",
    period_end: "",
  });

  useEffect(() => {
    fetchBudgets();
  }, []);

  async function fetchBudgets() {
    setLoading(true);
    try {
      const res = await apiGet<BudgetListData>("/budgets");
      if (res.success && res.data) {
        setBudgets(res.data.data);
      }
    } catch {
      // Demo data
      setBudgets(getDemoBudgets());
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        budget_type: form.budget_type,
        owner_id: form.owner_id || user?.empcloudUserId || 1,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        period: form.period,
        total_amount: parseInt(form.total_amount),
        period_start: form.period_start,
        period_end: form.period_end,
      };
      const res = await apiPost<Budget>("/budgets", body);
      if (res.success && res.data) {
        setBudgets((prev) => [res.data!, ...prev]);
        toast.success("Budget created successfully");
        setShowForm(false);
        resetForm();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to create budget");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      budget_type: "manager",
      owner_id: user?.empcloudUserId || 0,
      department_id: "",
      period: "monthly",
      total_amount: "",
      period_start: "",
      period_end: "",
    });
  }

  // Summary stats
  const totalAllocated = budgets.reduce((s, b) => s + Number(b.total_amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent_amount), 0);
  const activeBudgets = budgets.filter((b) => b.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recognition Budgets</h1>
          <p className="mt-1 text-sm text-gray-500">Manage recognition spending budgets by manager or department.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Create Budget"}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-medium uppercase text-gray-500">Total Allocated</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{totalAllocated.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-medium uppercase text-gray-500">Total Spent</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{totalSpent.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-500" />
            <span className="text-xs font-medium uppercase text-gray-500">Active Budgets</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{activeBudgets}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">New Budget</h3>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Budget Type</label>
              <div className="relative">
                <select
                  value={form.budget_type}
                  onChange={(e) => setForm((f) => ({ ...f, budget_type: e.target.value as any }))}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="manager">Manager</option>
                  <option value="department">Department</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Period</label>
              <div className="relative">
                <select
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as any }))}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount (Points)</label>
              <input
                type="number"
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                required
                min={1}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Period Start</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Period End</label>
              <input
                type="date"
                value={form.period_end}
                onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Budget"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget cards grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : budgets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No budgets configured yet.</p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              <Plus className="h-4 w-4" /> Create your first budget
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getDemoBudgets(): Budget[] {
  return [
    {
      id: "b1",
      budget_type: "manager",
      owner_id: 1,
      department_id: null,
      period: "monthly",
      total_amount: 5000,
      spent_amount: 3200,
      remaining_amount: 1800,
      period_start: "2026-03-01",
      period_end: "2026-03-31",
      is_active: true,
      created_at: "2026-03-01",
    },
    {
      id: "b2",
      budget_type: "department",
      owner_id: 2,
      department_id: 1,
      period: "quarterly",
      total_amount: 15000,
      spent_amount: 8750,
      remaining_amount: 6250,
      period_start: "2026-01-01",
      period_end: "2026-03-31",
      is_active: true,
      created_at: "2026-01-01",
    },
    {
      id: "b3",
      budget_type: "manager",
      owner_id: 3,
      department_id: null,
      period: "monthly",
      total_amount: 3000,
      spent_amount: 2850,
      remaining_amount: 150,
      period_start: "2026-03-01",
      period_end: "2026-03-31",
      is_active: true,
      created_at: "2026-03-01",
    },
    {
      id: "b4",
      budget_type: "department",
      owner_id: 4,
      department_id: 2,
      period: "annual",
      total_amount: 50000,
      spent_amount: 12500,
      remaining_amount: 37500,
      period_start: "2026-01-01",
      period_end: "2026-12-31",
      is_active: true,
      created_at: "2026-01-01",
    },
  ];
}
