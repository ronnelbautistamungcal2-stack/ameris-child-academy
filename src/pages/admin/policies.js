import AdminLayout from "@/components/admin/AdminLayout";
import ParentFaqPanel from "@/components/admin/ParentFaqPanel";
import DocumentsPage from "@/components/documents/DocumentsPage";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Admin Policies & Procedures (client mockups 39-02 and 39-03), with the
// parent FAQs below.
export default function AdminPolicies() {
  const [centers, setCenters] = useState([]);
  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => setCenters(Array.isArray(rows) ? rows : []))
      .catch(() => setCenters([]));
  }, []);
  return (
    <AdminLayout title="Policies & Procedures">
      <DocumentsPage category="POLICY" />
      <div className="mt-6">
        <ParentFaqPanel centers={centers} />
      </div>
    </AdminLayout>
  );
}
