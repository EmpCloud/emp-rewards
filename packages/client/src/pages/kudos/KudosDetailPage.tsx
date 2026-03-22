import { Heart } from "lucide-react";

export function KudosDetailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kudos Detail</h1>
        <p className="mt-1 text-sm text-gray-500">View kudos details, reactions, and comments.</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Heart className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Kudos detail view will be implemented here.</p>
      </div>
    </div>
  );
}
