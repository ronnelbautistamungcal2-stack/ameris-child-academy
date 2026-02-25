import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const DOMAIN_CONFIG = [
  { key: "cognitive", label: "Cognitive", color: "#7c3aed" },
  { key: "social", label: "Social-Emotional", color: "#0284c7" },
  { key: "physical", label: "Physical", color: "#059669" },
  { key: "language", label: "Language", color: "#d97706" },
  { key: "creative", label: "Creative", color: "#e11d48" },
];

export default function BehaviorFlowChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No behavior history available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-gray-700">{value}</span>}
        />
        {DOMAIN_CONFIG.map((d) => (
          <Area
            key={d.key}
            type="monotone"
            dataKey={d.key}
            name={d.label}
            stroke={d.color}
            fill={d.color}
            fillOpacity={0.1}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
