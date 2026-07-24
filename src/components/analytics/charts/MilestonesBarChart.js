import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function MilestonesBarChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No data.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={120} />
        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="% Passed" fill="#059669" radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
