import { StatsDashboard } from '@/components/StatsDashboard';

export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Panel de administración</h1>
      <StatsDashboard />
    </div>
  );
}
