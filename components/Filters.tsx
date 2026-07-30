'use client';

import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useFilterStore } from '@/store/useFilterStore';
import { cn } from '@/lib/utils';
import type { StatusFilter } from '@/types';

const OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'FREE', label: 'Libres' },
  { value: 'OCCUPIED', label: 'Ocupadas' },
];

export function Filters() {
  const { status, setStatus, favoritesOnly, toggleFavoritesOnly } = useFilterStore();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border bg-secondary/50 p-1">
        {OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
              status === opt.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Button
        variant={favoritesOnly ? 'default' : 'outline'}
        size="sm"
        onClick={toggleFavoritesOnly}
        className="gap-1.5"
      >
        <Star className={cn('h-4 w-4', favoritesOnly && 'fill-current')} />
        Favoritas
      </Button>
    </div>
  );
}
