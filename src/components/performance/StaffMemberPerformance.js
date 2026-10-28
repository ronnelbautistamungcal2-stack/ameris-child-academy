import { NAVY } from "@/components/reports/reportUi";
import TeacherSelfPerformanceReport from "@/components/teacher/TeacherSelfPerformanceReport";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// One staff member's performance page, opened from the Staff Performance
// Overview (client request: "clicking the teacher's name takes us to the
// Teacher Performance page").

export default function StaffMemberPerformance({ Layout, layoutProps = {}, backHref }) {
  const router = useRouter();
  const userId = typeof router.query.id === "string" ? router.query.id : "";
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        const wanted = typeof router.query.centerId === "string" ? router.query.centerId : "";
        setCenterId(list.some((c) => c.id === wanted) ? wanted : list[0]?.id || "");
      })
      .catch(() => setCenters([]));
  }, [router.isReady, router.query.centerId]);

  return (
    <Layout title="Teacher Performance" {...layoutProps}>
      <div className="space-y-4">
        <Link href={backHref} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">‹ Back to Staff Performance</Link>
        <h1 className={`text-3xl font-black ${NAVY}`}>Teacher Performance</h1>
        {userId && centerId ? (
          <TeacherSelfPerformanceReport
            centerId={centerId}
            centers={centers}
            loading={false}
            setCenterId={setCenterId}
            userId={userId}
            initialFrom={typeof router.query.from === "string" ? router.query.from : undefined}
            initialTo={typeof router.query.to === "string" ? router.query.to : undefined}
          />
        ) : null}
      </div>
    </Layout>
  );
}
