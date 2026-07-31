'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = { Libres: '#16A34A', Ocupadas: '#DC2626', 'Sin datos': '#94A3B8' };

export interface StatusPieChartData {
  free: number;
  occupied: number;
  unknown: number;
}

export function StatusPieChart({ free, occupied, unknown }: StatusPieChartData) {
  const pieData = [
    { name: 'Libres', value: free },
    { name: 'Ocupadas', value: occupied },
    { name: 'Sin datos', value: unknown },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
