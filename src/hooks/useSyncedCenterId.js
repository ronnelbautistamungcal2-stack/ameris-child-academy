import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";

export default function useSyncedCenterId(
  centerId,
  setCenterId,
  centers = [],
  options = {},
) {
  const router = useRouter();
  const blankQueryValue =
    typeof options?.blankQueryValue === "string"
      ? options.blankQueryValue
      : "";
  const rawQueryCenterId =
    typeof router.query.centerId === "string" ? router.query.centerId : "";
  const blankScopeSelected =
    !!blankQueryValue && rawQueryCenterId === blankQueryValue;
  const queryCenterId = blankScopeSelected ? "" : rawQueryCenterId;
  const normalizedCenterId = String(centerId || "");
  const previousCenterIdRef = useRef(normalizedCenterId);
  const storageKey = useMemo(() => {
    const firstSegment = String(router.pathname || "/")
      .split("/")
      .filter(Boolean)[0];
    return `aca:selectedCenter:${firstSegment || "global"}`;
  }, [router.pathname]);
  const validCenterIds = useMemo(
    () => new Set((centers || []).map((center) => String(center?.id || ""))),
    [centers],
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof window === "undefined") return;
    const storedCenterId = window.localStorage.getItem(storageKey) || "";
    const storedIsValid =
      !!storedCenterId &&
      (!validCenterIds.size || validCenterIds.has(String(storedCenterId)));

    if (blankScopeSelected) {
      if (normalizedCenterId) {
        setCenterId("");
      }
      return;
    }

    if (queryCenterId) {
      const queryIsValid =
        !validCenterIds.size || validCenterIds.has(String(queryCenterId));
      if (!queryIsValid) {
        if (!normalizedCenterId && storedIsValid) {
          setCenterId(storedCenterId);
          return;
        }
        if (!normalizedCenterId && centers.length === 1) {
          setCenterId(centers[0].id);
        }
        return;
      }

      if (queryCenterId !== normalizedCenterId) {
        setCenterId(queryCenterId);
      }
      if (queryCenterId !== storedCenterId) {
        window.localStorage.setItem(storageKey, queryCenterId);
      }
      return;
    }

    if (!normalizedCenterId && storedIsValid) {
      setCenterId(storedCenterId);
      return;
    }

    if (!normalizedCenterId && centers.length === 1) {
      setCenterId(centers[0].id);
    }
  }, [
    blankScopeSelected,
    centers,
    normalizedCenterId,
    queryCenterId,
    router.isReady,
    setCenterId,
    storageKey,
    validCenterIds,
  ]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!normalizedCenterId) return;
    if (typeof window === "undefined") return;
    if (validCenterIds.size && !validCenterIds.has(normalizedCenterId)) return;

    window.localStorage.setItem(storageKey, normalizedCenterId);
  }, [
    normalizedCenterId,
    router.isReady,
    storageKey,
    validCenterIds,
  ]);

  useEffect(() => {
    if (!router.isReady) return;
    const userClearedSelection =
      !!blankQueryValue &&
      !normalizedCenterId &&
      !!previousCenterIdRef.current;
    const desiredQueryCenterId =
      normalizedCenterId ||
      (blankScopeSelected || userClearedSelection ? blankQueryValue : "");
    if (rawQueryCenterId === desiredQueryCenterId) return;

    const nextQuery = { ...router.query };
    if (desiredQueryCenterId) nextQuery.centerId = desiredQueryCenterId;
    else delete nextQuery.centerId;

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }, [
    blankQueryValue,
    blankScopeSelected,
    normalizedCenterId,
    rawQueryCenterId,
    router,
  ]);

  useEffect(() => {
    previousCenterIdRef.current = normalizedCenterId;
  }, [normalizedCenterId]);
}
