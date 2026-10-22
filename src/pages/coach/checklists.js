import { useEffect } from "react";
import { useRouter } from "next/router";

// The old Daily Checklists page became Checklist Review.
export default function CoachChecklistsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/coach/checklist-review");
  }, [router]);
  return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
}
