import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return null;
}
