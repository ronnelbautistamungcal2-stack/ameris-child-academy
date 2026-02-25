import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const DOMAIN_COLORS = {
  cognitive: "#7c3aed",
  social: "#0284c7",
  physical: "#059669",
  language: "#d97706",
  creative: "#e11d48",
};

const DOMAIN_LABELS = {
  cognitive: "Cognitive",
  social: "Social-Emotional",
  physical: "Physical",
  language: "Language",
  creative: "Creative",
};

export default function DomainBarChart({ data = {} }) {
  const entries = Object.entries(data).map(([domain, score]) => ({
    domain: DOMAIN_LABELS[domain] || domain,
    key: domain,
    score: typeof score === "number" ? Math.round(score * 100) / 100 : 0,
  }));

  if (!entries.length || entries.every((e) => e.score === 0)) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No behavior score data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={entries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="domain" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value} / 4`, "Score"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {entries.map((entry, i) => (
            <Cell key={i} fill={DOMAIN_COLORS[entry.key] || "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
