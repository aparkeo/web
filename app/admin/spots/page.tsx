'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { labelForStatus } from '@/lib/utils';
import type { SpotStatus } from '@/types';

interface AdminSpot {
  id: number;
  street: string;
  lat: number;
  lon: number;
  spaces: number;
  status: SpotStatus;
  _count: { reports: number; favorites: number };
}

async function fetchAdminSpots(): Promise<AdminSpot[]> {
  const res = await fetch('/api/admin/spots');
  if (!res.ok) throw new Error('No se pudieron cargar las plazas');
  return res.json();
}

export default function AdminSpotsPage() {
  const queryClient = useQueryClient();
  const { data: spots = [], isLoading } = useQuery({ queryKey: ['admin-spots'], queryFn: fetchAdminSpots });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: '', street: '', lat: '', lon: '', spaces: '1' });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: SpotStatus }) =>
      fetch(`/api/admin/spots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-spots'] });
      toast.success('Estado actualizado');
    },
  });

  const deleteSpot = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/spots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-spots'] });
      toast.success('Plaza eliminada');
    },
  });

  const createSpot = useMutation({
    mutationFn: () =>
      fetch('/api/admin/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(form.id),
          street: form.street,
          lat: Number(form.lat),
          lon: Number(form.lon),
          spaces: Number(form.spaces),
        }),
      }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error('No se pudo crear la plaza (¿id duplicado?)');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['admin-spots'] });
      setOpen(false);
      setForm({ id: '', street: '', lat: '', lon: '', spaces: '1' });
      toast.success('Plaza creada');
    },
  });

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Administración</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Gestionar plazas</h1>
          <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
            Alta de plazas del dataset oficial y control manual de su estado.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-cta gap-1.5">
              <Plus className="h-4 w-4" /> Nueva plaza
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva plaza PMR</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>ID (del dataset oficial)</Label>
                <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Calle</Label>
                <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Latitud</Label>
                  <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} type="number" step="any" />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitud</Label>
                  <Input value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} type="number" step="any" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Plazas</Label>
                <Input value={form.spaces} onChange={(e) => setForm({ ...form, spaces: e.target.value })} type="number" min={1} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createSpot.mutate()} disabled={createSpot.isPending}>
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="rounded-2xl shadow-elevated">
        <CardHeader>
          <CardTitle>{spots.length} plazas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            spots.map((spot) => (
              <div key={spot.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-secondary/40">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{spot.street}</p>
                  <p className="text-xs text-muted-foreground">
                    #{spot.id} · {spot._count.reports} reportes · {spot._count.favorites} favoritos
                  </p>
                </div>

                <Select value={spot.status} onValueChange={(status) => updateStatus.mutate({ id: spot.id, status: status as SpotStatus })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['FREE', 'OCCUPIED', 'UNKNOWN'] as SpotStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {labelForStatus(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="icon" onClick={() => deleteSpot.mutate(spot.id)} aria-label="Eliminar plaza">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
