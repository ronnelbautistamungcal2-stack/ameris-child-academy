import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

export function useRequireRole(allowedRoles, redirectTo = "/dashboard") {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
      return;
    }
    const role = session.user?.role;
    if (!allowedRoles.includes(role)) {
      router.replace(redirectTo);
    }
  }, [allowedRoles, redirectTo, router, session, status]);

  const role = session?.user?.role;
  const allowed = !!role && allowedRoles.includes(role);

  return { session, status, allowed, update };
}
