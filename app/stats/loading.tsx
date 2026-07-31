import { Skeleton } from '@/components/ui/skeleton';

export default function StatsLoading() {
  return (
    <div className="container max-w-5xl py-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
