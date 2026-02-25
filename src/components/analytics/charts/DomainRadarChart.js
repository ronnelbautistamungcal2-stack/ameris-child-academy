import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const DOMAIN_LABELS = {
  cognitive: "Cognitive",
  social: "Social-Emotional",
  physical: "Physical",
  language: "Language",
  creative: "Creative",
};

export default function DomainRadarChart({ data = {}, label = "Score" }) {
  const entries = Object.entries(data).map(([domain, score]) => ({
    domain: DOMAIN_LABELS[domain] || domain,
    score: typeof score === "number" ? Math.round(score * 100) / 100 : 0,
    fullMark: 4,
  }));

  if (!entries.length || entries.every((e) => e.score === 0)) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No domain score data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={entries} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => [`${value} / 4`, label]} contentStyle={{ fontSize: 12 }} />
        <Radar
          name={label}
          dataKey="score"
          stroke="#7c3aed"
          fill="#7c3aed"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
