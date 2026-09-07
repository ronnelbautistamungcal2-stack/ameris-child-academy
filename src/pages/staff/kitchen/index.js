import { useEffect } from "react";
import { useRouter } from "next/router";

export default function StaffKitchenIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/kitchen/menus");
  }, [router]);

  return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
}
