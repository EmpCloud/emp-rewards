import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Search, Send, ArrowLeft, Loader2 } from "lucide-react";
import { apiPost, apiGet } from "@/api/client";
import { cn } from "@/lib/utils";

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  points_multiplier: number;
}

export function SendKudosPage() {
  const navigate = useNavigate();
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState<Employee[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Employee | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mock employee search — in production this would call empcloud API
  useEffect(() => {
    if (recipientSearch.length < 2) {
      setRecipients([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // This would be an empcloud API call in production
        // For now we simulate with a placeholder
        const res = await apiGet<any>("/kudos", { page: 1, perPage: 5 });
        // Simulate employees from any available data
        setRecipients([]);
      } catch {
        // silent
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [recipientSearch]);

  // Fetch categories
  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<any>("/badges");
        // Categories would come from a settings/categories endpoint
        // For now we use static categories
      } catch {
        // silent
      }
    })();
  }, []);

  const DEFAULT_CATEGORIES = [
    { id: "teamwork", name: "Teamwork", icon: "users", color: "#3B82F6", description: "Collaboration", points_multiplier: 1 },
    { id: "innovation", name: "Innovation", icon: "lightbulb", color: "#F59E0B", description: "Creative thinking", points_multiplier: 1.5 },
    { id: "leadership", name: "Leadership", icon: "star", color: "#8B5CF6", description: "Guiding others", points_multiplier: 1.5 },
    { id: "customer-focus", name: "Customer Focus", icon: "heart", color: "#EF4444", description: "Going above and beyond", points_multiplier: 1 },
    { id: "excellence", name: "Excellence", icon: "award", color: "#10B981", description: "Exceptional work", points_multiplier: 2 },
    { id: "mentoring", name: "Mentoring", icon: "book-open", color: "#6366F1", description: "Helping others grow", points_multiplier: 1 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRecipient) {
      setError("Please select a recipient");
      return;
    }
    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    setSubmitting(true);
    try {
      // Only send category_id if it's a valid UUID (server-stored category);
      // skip default/hardcoded categories that are not real DB records.
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedCategory);
      await apiPost("/kudos", {
        receiver_id: selectedRecipient.id,
        category_id: isUUID ? selectedCategory : undefined,
        message: message.trim(),
        visibility,
        is_anonymous: isAnonymous,
      });
      setSuccess(true);
      setTimeout(() => navigate("/feed"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to send kudos");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Heart className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Kudos Sent!</h2>
          <p className="mt-1 text-sm text-gray-500">Your recognition has been shared.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Send Kudos</h1>
          <p className="mt-1 text-sm text-gray-500">Recognize a colleague for their great work.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 overflow-visible">
        {/* Recipient search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient</label>
          {selectedRecipient ? (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRecipient.first_name} {selectedRecipient.last_name}
                </p>
                <p className="text-xs text-gray-500">{selectedRecipient.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecipient(null);
                  setRecipientSearch("");
                }}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative z-10">
              <Search className="absolute left-3 top-[13px] h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees by name or email..."
                value={recipientSearch}
                onChange={(e) => {
                  setRecipientSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              {/* Dropdown for search results */}
              {showDropdown && recipients.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {recipients.map((emp) => (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className="w-full px-4 py-2 text-left text-sm hover:bg-amber-50"
                        onMouseDown={() => {
                          setSelectedRecipient(emp);
                          setShowDropdown(false);
                        }}
                      >
                        <span className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</span>
                        {emp.email && <span className="ml-2 text-xs text-gray-400">{emp.email}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Enter the Employee ID number directly if search is unavailable
              </p>
              {/* Manual ID entry fallback */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="manual-employee-id"
                  type="number"
                  placeholder="Or enter Employee ID"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (val > 0) {
                        setSelectedRecipient({
                          id: val,
                          first_name: "Employee",
                          last_name: `#${val}`,
                          email: "",
                          designation: null,
                        });
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("manual-employee-id") as HTMLInputElement;
                    const val = parseInt(input?.value, 10);
                    if (val > 0) {
                      setSelectedRecipient({
                        id: val,
                        first_name: "Employee",
                        last_name: `#${val}`,
                        email: "",
                        designation: null,
                      });
                    }
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Select
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selectedCategory === cat.id
                    ? "border-amber-400 bg-amber-50"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md text-xs"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  {cat.name[0]}
                </span>
                <div>
                  <p className="font-medium text-gray-900">{cat.name}</p>
                  {cat.points_multiplier > 1 && (
                    <p className="text-xs text-amber-600">{cat.points_multiplier}x points</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
          <textarea
            rows={4}
            placeholder="Tell them why you appreciate their work..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">{message.length}/1000</p>
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Visibility */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Visibility:</label>
            <div className="flex rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors",
                  visibility === "public"
                    ? "bg-amber-500 text-white"
                    : "text-gray-600 hover:bg-gray-50",
                )}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-r-lg transition-colors",
                  visibility === "private"
                    ? "bg-amber-500 text-white"
                    : "text-gray-600 hover:bg-gray-50",
                )}
              >
                Private
              </button>
            </div>
          </div>

          {/* Anonymous */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm text-gray-700">Send anonymously</span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? "Sending..." : "Send Kudos"}
        </button>
      </form>
    </div>
  );
}
