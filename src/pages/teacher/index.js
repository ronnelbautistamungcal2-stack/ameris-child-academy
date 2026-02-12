import { useEffect } from "react";
import { useRouter } from "next/router";

export default function TeacherIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher/dashboard");
  }, [router]);

  return <div className="p-6 text-sm text-gray-600">Redirecting…</div>;
}

