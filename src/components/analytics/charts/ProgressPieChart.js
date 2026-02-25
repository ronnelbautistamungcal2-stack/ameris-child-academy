import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const STATUS_COLORS = {
  NOT_STARTED: "#9ca3af",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#10b981",
  PASSED: "#059669",
  FAILED: "#ef4444",
};

const STATUS_LABELS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

export default function ProgressPieChart({ data = {} }) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      value,
      color: STATUS_COLORS[status] || "#6b7280",
    }));

  if (!entries.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No progress data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={entries}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          style={{ fontSize: 11 }}
        >
          {entries.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, "Count"]} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
