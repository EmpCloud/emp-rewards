import { Award } from "lucide-react";
import { tr } from "@/lib/i18n";

export function BadgeDetailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{tr("Badge Detail")}</h1>
        <p className="mt-1 text-sm text-gray-500">{tr("Badge criteria and recipients.")}</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Award className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">{tr("Badge detail view will be implemented here.")}</p>
      </div>
    </div>
  );
}
