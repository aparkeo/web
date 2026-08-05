'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilterStore } from '@/store/useFilterStore';

export function SearchBar() {
  const search = useFilterStore((s) => s.search);
  const setSearch = useFilterStore((s) => s.setSearch);

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar calle o zona…"
        className="h-12 rounded-xl pl-10 pr-12 text-base shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-md"
        aria-label="Buscar plaza por calle"
      />
      {search ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground"
          onClick={() => setSearch('')}
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
