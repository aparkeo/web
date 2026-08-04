'use client';

import { useShallow } from 'zustand/react/shallow';
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
  const { status, setStatus, favoritesOnly, toggleFavoritesOnly } = useFilterStore(
    useShallow((s) => ({
      status: s.status,
      setStatus: s.setStatus,
      favoritesOnly: s.favoritesOnly,
      toggleFavoritesOnly: s.toggleFavoritesOnly,
    })),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-border bg-secondary/60 p-1 shadow-sm">
        {OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            aria-pressed={status === opt.value}
            className={cn(
              'min-h-11 rounded-full px-4 text-sm font-semibold transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              status === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Button
        variant={favoritesOnly ? 'default' : 'outline'}
        onClick={toggleFavoritesOnly}
        aria-pressed={favoritesOnly}
        className={cn(
          'min-h-11 gap-1.5 rounded-full px-4 text-sm font-semibold transition-[transform,box-shadow,background-color,color,border-color] duration-200 hover:-translate-y-0.5 active:translate-y-0',
          favoritesOnly && 'shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.55)]',
        )}
      >
        <Star className={cn('h-4 w-4', favoritesOnly && 'fill-current')} />
        Favoritas
      </Button>
    </div>
  );
}
