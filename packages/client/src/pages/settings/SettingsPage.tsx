import { useState, useEffect } from "react";
import { Settings, Plus, Pencil, Trash2, X, Check, Palette } from "lucide-react";
import { apiGet, apiPut, apiPost, apiDelete } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import toast from "react-hot-toast";

interface RecognitionSettings {
  id: string;
  points_per_kudos: number;
  max_kudos_per_day: number;
  allow_self_kudos: boolean;
  allow_anonymous_kudos: boolean;
  default_visibility: string;
  points_currency_name: string;
  require_category: boolean;
  require_message: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  points_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

const ICON_OPTIONS = [
  "star", "heart", "trophy", "zap", "target", "award", "flame", "sparkles",
  "thumbs-up", "rocket", "lightbulb", "shield", "gem", "crown", "medal",
];

const COLOR_OPTIONS = [
  "#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#6366f1",
];

const TABS = [
  { key: "general", label: "General" },
  { key: "categories", label: "Categories" },
];

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user && ["org_admin", "hr_admin"].includes(user.role);

  const [tab, setTab] = useState("general");
  const [settings, setSettings] = useState<RecognitionSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", icon: "star", color: "#f59e0b", points_multiplier: "1" });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [settingsRes, catsRes] = await Promise.allSettled([
        apiGet<RecognitionSettings>("/settings"),
        apiGet<Category[]>("/settings/categories", { includeInactive: "true" }),
      ]);
      if (settingsRes.status === "fulfilled" && settingsRes.value.data) {
        setSettings(settingsRes.value.data);
      }
      if (catsRes.status === "fulfilled" && catsRes.value.data) {
        setCategories(catsRes.value.data);
      }
    } catch {
      // Demo data
      setSettings(getDemoSettings());
      setCategories(getDemoCategories());
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings || !isAdmin) return;
    setSaving(true);
    try {
      const res = await apiPut<RecognitionSettings>("/settings", {
        points_per_kudos: settings.points_per_kudos,
        max_kudos_per_day: settings.max_kudos_per_day,
        allow_self_kudos: settings.allow_self_kudos,
        allow_anonymous_kudos: settings.allow_anonymous_kudos,
        default_visibility: settings.default_visibility,
        points_currency_name: settings.points_currency_name,
        require_category: settings.require_category,
        require_message: settings.require_message,
      });
      if (res.success && res.data) {
        setSettings(res.data);
        toast.success("Settings saved");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: catForm.name,
        description: catForm.description || null,
        icon: catForm.icon,
        color: catForm.color,
        points_multiplier: parseFloat(catForm.points_multiplier) || 1,
      };

      if (editingCat) {
        const res = await apiPut<Category>(`/settings/categories/${editingCat.id}`, body);
        if (res.success && res.data) {
          setCategories((prev) => prev.map((c) => (c.id === editingCat.id ? res.data! : c)));
          toast.success("Category updated");
        }
      } else {
        const res = await apiPost<Category>("/settings/categories", body);
        if (res.success && res.data) {
          setCategories((prev) => [...prev, res.data!]);
          toast.success("Category created");
        }
      }
      closeCatForm();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Deactivate this category? It can be reactivated later.")) return;
    try {
      await apiDelete(`/settings/categories/${id}`);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
      toast.success("Category deactivated");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to delete category");
    }
  }

  function openEditCategory(cat: Category) {
    setEditingCat(cat);
    setCatForm({
      name: cat.name,
      description: cat.description || "",
      icon: cat.icon || "star",
      color: cat.color || "#f59e0b",
      points_multiplier: String(cat.points_multiplier),
    });
    setShowCatForm(true);
  }

  function closeCatForm() {
    setShowCatForm(false);
    setEditingCat(null);
    setCatForm({ name: "", description: "", icon: "star", color: "#f59e0b", points_multiplier: "1" });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure recognition settings, categories, and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* General Tab */}
      {tab === "general" && settings && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-5 text-base font-semibold text-gray-900">Recognition Configuration</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Per Kudos</label>
              <input
                type="number"
                value={settings.points_per_kudos}
                onChange={(e) => setSettings((s) => s && { ...s, points_per_kudos: parseInt(e.target.value) || 0 })}
                disabled={!isAdmin}
                min={0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">Default points awarded per kudos</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Kudos Per Day</label>
              <input
                type="number"
                value={settings.max_kudos_per_day}
                onChange={(e) => setSettings((s) => s && { ...s, max_kudos_per_day: parseInt(e.target.value) || 1 })}
                disabled={!isAdmin}
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">Limit per user per day</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Currency Name</label>
              <input
                type="text"
                value={settings.points_currency_name}
                onChange={(e) => setSettings((s) => s && { ...s, points_currency_name: e.target.value })}
                disabled={!isAdmin}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">e.g. "Points", "Stars", "Coins"</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Visibility</label>
              <select
                value={settings.default_visibility}
                onChange={(e) => setSettings((s) => s && { ...s, default_visibility: e.target.value })}
                disabled={!isAdmin}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_anonymous_kudos}
                onChange={(e) => setSettings((s) => s && { ...s, allow_anonymous_kudos: e.target.checked })}
                disabled={!isAdmin}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Allow Anonymous Kudos</span>
                <p className="text-xs text-gray-400">Users can send kudos without revealing their identity</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allow_self_kudos}
                onChange={(e) => setSettings((s) => s && { ...s, allow_self_kudos: e.target.checked })}
                disabled={!isAdmin}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Allow Self-Kudos</span>
                <p className="text-xs text-gray-400">Users can send kudos to themselves</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_category}
                onChange={(e) => setSettings((s) => s && { ...s, require_category: e.target.checked })}
                disabled={!isAdmin}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Require Category</span>
                <p className="text-xs text-gray-400">Users must select a category when sending kudos</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_message}
                onChange={(e) => setSettings((s) => s && { ...s, require_message: e.target.checked })}
                disabled={!isAdmin}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Require Message</span>
                <p className="text-xs text-gray-400">Users must write a message when sending kudos</p>
              </div>
            </label>
          </div>

          {isAdmin && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {tab === "categories" && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => { closeCatForm(); setShowCatForm(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                <Plus className="h-4 w-4" /> Add Category
              </button>
            </div>
          )}

          {/* Category form */}
          {showCatForm && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {editingCat ? "Edit Category" : "New Category"}
                </h3>
                <button onClick={closeCatForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={saveCategory} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={catForm.name}
                      onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      placeholder="e.g. Teamwork"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Points Multiplier</label>
                    <input
                      type="number"
                      value={catForm.points_multiplier}
                      onChange={(e) => setCatForm((f) => ({ ...f, points_multiplier: e.target.value }))}
                      min={0.1}
                      max={10}
                      step={0.1}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={catForm.description}
                    onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setCatForm((f) => ({ ...f, icon }))}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          catForm.icon === icon
                            ? "border-amber-500 bg-amber-100 text-amber-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCatForm((f) => ({ ...f, color }))}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          catForm.color === color ? "border-gray-900 scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCatForm}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editingCat ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Category list */}
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {categories.length === 0 && (
              <div className="p-12 text-center">
                <Palette className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No categories yet.</p>
              </div>
            )}
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`flex items-center gap-4 px-5 py-4 ${!cat.is_active ? "opacity-50" : ""}`}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-xs font-bold"
                  style={{ backgroundColor: cat.color || "#f59e0b" }}
                >
                  {(cat.icon || cat.name[0]).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                    {!cat.is_active && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">Inactive</span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-xs text-gray-500 truncate">{cat.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{cat.points_multiplier}x</p>
                  <p className="text-[10px] text-gray-400">multiplier</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditCategory(cat)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {cat.is_active && (
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getDemoSettings(): RecognitionSettings {
  return {
    id: "s1",
    points_per_kudos: 10,
    max_kudos_per_day: 5,
    allow_self_kudos: false,
    allow_anonymous_kudos: true,
    default_visibility: "public",
    points_currency_name: "Points",
    require_category: false,
    require_message: true,
  };
}

function getDemoCategories(): Category[] {
  return [
    { id: "c1", name: "Teamwork", description: "Collaborating effectively with others", icon: "heart", color: "#f59e0b", points_multiplier: 1, is_active: true, sort_order: 1 },
    { id: "c2", name: "Innovation", description: "Creative solutions and new ideas", icon: "lightbulb", color: "#3b82f6", points_multiplier: 1.5, is_active: true, sort_order: 2 },
    { id: "c3", name: "Leadership", description: "Leading by example", icon: "crown", color: "#8b5cf6", points_multiplier: 2, is_active: true, sort_order: 3 },
    { id: "c4", name: "Customer Focus", description: "Going above and beyond for customers", icon: "target", color: "#10b981", points_multiplier: 1.5, is_active: true, sort_order: 4 },
    { id: "c5", name: "Quality", description: "Delivering excellence", icon: "award", color: "#ef4444", points_multiplier: 1, is_active: true, sort_order: 5 },
  ];
}
