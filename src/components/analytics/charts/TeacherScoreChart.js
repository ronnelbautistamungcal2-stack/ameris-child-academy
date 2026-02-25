import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const COMPONENT_CONFIG = [
  { key: "childProgress", label: "Child Progress (40%)", color: "#7c3aed" },
  { key: "behaviorImprovement", label: "Behavior Improvement (25%)", color: "#0284c7" },
  { key: "activityLogging", label: "Activity Logging (20%)", color: "#059669" },
  { key: "attendanceTracking", label: "Attendance Tracking (15%)", color: "#d97706" },
];

export default function TeacherScoreChart({ breakdown = {} }) {
  const entries = COMPONENT_CONFIG.map((c) => ({
    ...c,
    score: typeof breakdown[c.key] === "number" ? Math.round(breakdown[c.key] * 10) / 10 : 0,
  }));

  if (entries.every((e) => e.score === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No performance data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={entries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value} / 100`, "Score"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {entries.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
