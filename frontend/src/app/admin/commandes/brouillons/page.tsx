import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminOrderDraftsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-xl text-dark-800">Commandes</h1>
        <p className="text-sm text-gray-500">Commandes créées manuellement par l’admin</p>
      </div>
      <AdminOrdersTabs />
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-16 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-dark-700">Aucun brouillon</p>
          <p className="mt-1 text-sm text-gray-500">Les commandes manuelles apparaîtront ici lorsqu’elles seront disponibles.</p>
        </div>
      </div>
    </div>
  );
}
