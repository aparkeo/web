'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useT } from '@/components/i18n/I18nProvider';

const COLORS = { free: '#16A34A', occupied: '#DC2626', unknown: '#94A3B8' };

export interface StatusPieChartData {
  free: number;
  occupied: number;
  unknown: number;
}

export function StatusPieChart({ free, occupied, unknown }: StatusPieChartData) {
  const t = useT();
  const pieData = [
    { key: 'free' as const, name: t.status.freePlural, value: free },
    { key: 'occupied' as const, name: t.status.occupiedPlural, value: occupied },
    { key: 'unknown' as const, name: t.status.unknown, value: unknown },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
          {pieData.map((entry) => (
            <Cell key={entry.key} fill={COLORS[entry.key]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
