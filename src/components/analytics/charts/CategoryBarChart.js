import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function CategoryBarChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No category progress data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={120} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
        />
        <Bar dataKey="completed" name="Completed" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
        <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#f59e0b" />
        <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
        <Bar dataKey="notStarted" name="Not Started" stackId="a" fill="#d1d5db" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
