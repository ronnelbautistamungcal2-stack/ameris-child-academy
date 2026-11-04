import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Bars with their count on top (Course Correction / Character Highlight charts).
// onSelect(bar) makes a bar clickable to list the students behind it; the
// labels wrap onto two lines so long names stay readable (client request 2026-10-29).

function WrappedTick({ x, y, payload }) {
  const words = String(payload?.value || "").split(" ");
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= 12) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return (
    <g transform={`translate(${x},${y + 10})`}>
      <text textAnchor="middle" fontSize={10} fill="#374151">
        {lines.slice(0, 3).map((line, i) => (
          <tspan key={i} x={0} dy={i ? 12 : 0}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

export default function CountsBarChart({ data, color, onSelect, selected }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="label" interval={0} tick={<WrappedTick />} height={56} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar
          dataKey="count"
          name="Entries"
          fill={color}
          radius={[3, 3, 0, 0]}
          cursor={onSelect ? "pointer" : undefined}
          onClick={onSelect ? (bar) => bar?.count && onSelect(bar.payload || bar) : undefined}
        >
          {data.map((d) => (
            <Cell key={d.key || d.label} fill={color} fillOpacity={selected && selected !== (d.key || d.label) ? 0.45 : 1} />
          ))}
          <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
