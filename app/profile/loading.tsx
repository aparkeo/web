import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
