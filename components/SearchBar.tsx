'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilterStore } from '@/store/useFilterStore';

export function SearchBar() {
  const { search, setSearch } = useFilterStore();

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar calle o zona…"
        className="pl-9 pr-9"
        aria-label="Buscar plaza por calle"
      />
      {search ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => setSearch('')}
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
