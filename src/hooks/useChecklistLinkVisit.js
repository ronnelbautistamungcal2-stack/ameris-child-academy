import { useEffect } from "react";
import { useRouter } from "next/router";
import { apiJson } from "@/lib/api";

// When Log Activity is opened from a checklist item (?checklistItem=<id>),
// record the visit so that item can be checked off (see checklistLinks.js).
export default function useChecklistLinkVisit() {
  const router = useRouter();
  const itemId = typeof router.query.checklistItem === "string" ? router.query.checklistItem : "";
  useEffect(() => {
    if (!router.isReady || !itemId) return;
    apiJson("/api/v1/daily-checklists/visit", {
      method: "POST",
      body: JSON.stringify({ itemId }),
    }).catch(() => {});
  }, [router.isReady, itemId]);
}
