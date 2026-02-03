import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { getSocket } from "@/lib/socket-client";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    async function load() {
      const sess = await getSession();
      // For demo, fetch all activities (or filter by childId)
      const res = await fetch("/api/v1/activities");
      if (res.ok) setActivities(await res.json());
    }
    load();

    const socket = getSocket();
    socket.on("activity:logged", (payload) => {
      setActivities((cur) => [payload.data, ...cur]);
    });
    return () => socket.off("activity:logged");
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", padding: 20 }}>
      <h2>Activities</h2>
      <p>
        <Link href="/activities/new">Create activity</Link>
      </p>
      <ul>
        {activities.map((a) => (
          <li key={a.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>{a.type}</strong> — {a.notes} <br />
            <small>
              {a.recordedBy?.name || a.recordedById} @{" "}
              {new Date(a.createdAt).toLocaleString()}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}
