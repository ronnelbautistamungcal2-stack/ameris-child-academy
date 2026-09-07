import { useEffect } from "react";
import { useRouter } from "next/router";

export default function StaffRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/checklist");
  }, [router]);

  return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
}
