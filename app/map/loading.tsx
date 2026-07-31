import { Skeleton } from '@/components/ui/skeleton';

export default function MapLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
      <aside className="hidden w-96 shrink-0 border-r border-border bg-background md:block" aria-hidden="true">
        <div className="space-y-3 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2 p-4 pt-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Cargando mapa…</p>
      </div>
    </div>
  );
}
