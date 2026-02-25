import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const DEFAULT_COLORS = ["#7c3aed", "#0284c7", "#059669", "#d97706", "#e11d48", "#6b7280"];

export default function TrendLineChart({ data = [], lines = [], yDomain, yLabel }) {
  if (!data.length || !lines.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No trend data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis domain={yDomain || ["auto", "auto"]} tick={{ fontSize: 11 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } } : undefined} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
        />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label || line.key}
            stroke={line.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
