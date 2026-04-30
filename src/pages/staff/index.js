import { useEffect } from "react";
import { useRouter } from "next/router";

export default function StaffIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/dashboard");
  }, [router]);

  return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
}
