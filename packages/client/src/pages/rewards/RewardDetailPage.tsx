import { Gift } from "lucide-react";
import { tr } from "@/lib/i18n";

export function RewardDetailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{tr("Reward Detail")}</h1>
        <p className="mt-1 text-sm text-gray-500">{tr("View reward details and redeem with points.")}</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Gift className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">{tr("Reward detail and redemption form will be implemented here.")}</p>
      </div>
    </div>
  );
}
