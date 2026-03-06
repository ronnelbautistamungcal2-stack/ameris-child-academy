import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function PageLoadingBar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = () => setLoading(true);
    const end = () => setLoading(false);

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", end);
    router.events.on("routeChangeError", end);

    return () => {
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", end);
      router.events.off("routeChangeError", end);
    };
  }, [router]);

  if (!loading) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[200]">
      <div
        className="h-[3px] bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"
        style={{ animation: "nprogress 2s ease-in-out infinite" }}
      />
    </div>
  );
}
