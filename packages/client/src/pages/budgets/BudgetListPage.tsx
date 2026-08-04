import { useState, useEffect } from "react";
import { Wallet, Plus, X, ChevronDown, DollarSign, TrendingUp, Pencil, Trash2, Loader2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import toast from "react-hot-toast";
import { tr } from "@/lib/i18n";
import { activeLocale } from "@/lib/utils";

interface Budget {
  id: string;
  budget_type: string;
  owner_id: number;
  owner_name?: string;
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

// Format an ISO date string as "May 30, 2026" (or "—" if missing/invalid).
function fmtDate(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString(activeLocale(), { month: "short", day: "numeric", year: "numeric" });
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
        <span className="text-gray-500">{pct}{tr("% used")}</span>
        <span className="font-medium text-gray-700">{spent.toLocaleString(activeLocale())} / {total.toLocaleString(activeLocale())}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BudgetCard({
  budget,
  isAdmin,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  isAdmin: boolean;
  onEdit: (b: Budget) => void;
  onDelete: (b: Budget) => void;
}) {
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
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {budget.owner_name ||
                (budget.budget_type === "department"
                  ? `Department ${budget.department_id ?? ""}`.trim()
                  : `Owner #${budget.owner_id}`)}
            </p>
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600">
              {budget.budget_type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${budget.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {budget.is_active ? tr("Active") : tr("Inactive")}
          </span>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(budget)}
                title={tr("Edit budget")}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-amber-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(budget)}
                title={tr("Delete budget")}
                className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900">{total.toLocaleString(activeLocale())}</p>
          <p className="text-[10px] uppercase text-gray-500">{tr("Allocated")}</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-700">{spent.toLocaleString(activeLocale())}</p>
          <p className="text-[10px] uppercase text-gray-500">{tr("Spent")}</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-700">{remaining.toLocaleString(activeLocale())}</p>
          <p className="text-[10px] uppercase text-gray-500">{tr("Remaining")}</p>
        </div>
      </div>

      <ProgressBar spent={spent} total={total} />

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span className="capitalize">{budget.period}</span>
        <span>{fmtDate(budget.period_start)} – {fmtDate(budget.period_end)}</span>
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

  // Edit / delete state
  const [editing, setEditing] = useState<Budget | null>(null);
  const [editForm, setEditForm] = useState({ total_amount: "", period_start: "", period_end: "", is_active: true });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

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

    const totalAmount = Number(form.total_amount);
    if (!totalAmount || totalAmount <= 0) {
      toast.error(tr("Please enter a valid budget amount"));
      return;
    }
    if (!form.period_start || !form.period_end) {
      toast.error(tr("Please select period start and end dates"));
      return;
    }
    if (form.period_end < form.period_start) {
      toast.error(tr("Period end date cannot be before start date"));
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        budget_type: form.budget_type,
        owner_id: form.owner_id || user?.empcloudUserId || 1,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        period: form.period,
        total_amount: totalAmount,
        period_start: form.period_start,
        period_end: form.period_end,
      };
      const res = await apiPost<Budget>("/budgets", body);
      if (res.success && res.data) {
        setBudgets((prev) => [res.data!, ...prev]);
        toast.success(tr("Budget created successfully"));
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

  function openEdit(b: Budget) {
    setEditing(b);
    setEditForm({
      total_amount: String(b.total_amount),
      // backend stores dates; trim any time portion to YYYY-MM-DD for the date input
      period_start: (b.period_start || "").slice(0, 10),
      period_end: (b.period_end || "").slice(0, 10),
      is_active: b.is_active,
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const total = Number(editForm.total_amount);
    if (!total || total <= 0) {
      toast.error(tr("Please enter a valid budget amount"));
      return;
    }
    if (editForm.period_end < editForm.period_start) {
      toast.error(tr("Period end date cannot be before start date"));
      return;
    }
    setSavingEdit(true);
    try {
      const res = await apiPut<Budget>(`/budgets/${editing.id}`, {
        total_amount: total,
        period_start: editForm.period_start,
        period_end: editForm.period_end,
        is_active: editForm.is_active,
      });
      if (res.success && res.data) {
        setBudgets((prev) => prev.map((b) => (b.id === editing.id ? res.data! : b)));
        toast.success(tr("Budget updated"));
        setEditing(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to update budget");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await apiDelete(`/budgets/${deleting.id}`);
      setBudgets((prev) => prev.filter((b) => b.id !== deleting.id));
      toast.success(tr("Budget deleted"));
      setDeleting(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to delete budget");
    } finally {
      setDeletingBusy(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">{tr("Recognition Budgets")}</h1>
          <p className="mt-1 text-sm text-gray-500">{tr("Manage recognition spending budgets by manager or department.")}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? tr("Cancel") : tr("Create Budget")}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-medium uppercase text-gray-500">{tr("Total Allocated")}</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{totalAllocated.toLocaleString(activeLocale())}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-medium uppercase text-gray-500">{tr("Total Spent")}</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{totalSpent.toLocaleString(activeLocale())}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-500" />
            <span className="text-xs font-medium uppercase text-gray-500">{tr("Active Budgets")}</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-900">{activeBudgets}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">{tr("New Budget")}</h3>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tr("Budget Type")}</label>
              <div className="relative">
                <select
                  value={form.budget_type}
                  onChange={(e) => setForm((f) => ({ ...f, budget_type: e.target.value as any }))}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="manager">{tr("Manager")}</option>
                  <option value="department">{tr("Department")}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tr("Period")}</label>
              <div className="relative">
                <select
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as any }))}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="monthly">{tr("Monthly")}</option>
                  <option value="quarterly">{tr("Quarterly")}</option>
                  <option value="annual">{tr("Annual")}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tr("Total Amount (Points)")}</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">{tr("Period Start")}</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tr("Period End")}</label>
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
                {submitting ? tr("Creating...") : tr("Create Budget")}
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
            <BudgetCard
              key={budget.id}
              budget={budget}
              isAdmin={!!isAdmin}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{tr("No budgets configured yet.")}</p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              <Plus className="h-4 w-4" />  {tr("Create your first budget")}
            </button>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{tr("Edit Budget")}</h3>
              <button onClick={() => setEditing(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">{tr("Total Amount (Points)")}</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.total_amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, total_amount: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="mt-1 text-xs text-gray-400">

                  {tr("Spent so far:")} {Number(editing.spent_amount).toLocaleString(activeLocale())}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{tr("Period Start")}</label>
                  <input
                    type="date"
                    value={editForm.period_start}
                    onChange={(e) => setEditForm((f) => ({ ...f, period_start: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{tr("Period End")}</label>
                  <input
                    type="date"
                    value={editForm.period_end}
                    onChange={(e) => setEditForm((f) => ({ ...f, period_end: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                />

                {tr("Active")}
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >

                  {tr("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}

                  {tr("Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{tr("Delete Budget?")}</h3>
            <p className="mt-2 text-sm text-gray-500">

              {tr("This permanently deletes the")} {deleting.budget_type}  {tr("budget")}
              {" "}({Number(deleting.total_amount).toLocaleString(activeLocale())}  {tr("points). This cannot be undone.")}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >

                {tr("Cancel")}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingBusy && <Loader2 className="h-4 w-4 animate-spin" />}

                {tr("Delete")}
              </button>
            </div>
          </div>
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
