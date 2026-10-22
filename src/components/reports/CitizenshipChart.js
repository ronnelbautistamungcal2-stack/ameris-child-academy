import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Citizenship Grade line (0-10 score by day).
export default function CitizenshipChart({ points }) {
  const data = points.map((p) => ({
    ...p,
    label: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="linear" dataKey="score" name="Score" stroke="#1d6fe0" strokeWidth={2} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
