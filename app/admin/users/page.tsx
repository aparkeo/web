'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  reputationScore: number;
  createdAt: string;
  _count: { reports: number; favorites: number };
}

async function fetchUsers(): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users');
  if (!res.ok) throw new Error('No se pudieron cargar los usuarios');
  return res.json();
}

export default function AdminUsersPage() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });

  return (
    <div>
      <header className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Administración</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Usuarios</h1>
        <p className="mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          Cuentas registradas, su actividad y su fiabilidad como reporteros.
        </p>
      </header>
      <Card className="rounded-2xl shadow-elevated">
        <CardHeader>
          <CardTitle>{users.length} usuarios registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm transition-colors duration-150 hover:bg-secondary/40">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{u.name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {u._count.reports} reportes · {u._count.favorites} favoritas · desde{' '}
                    {formatRelativeTime(new Date(u.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.reputationScore < 70 ? 'destructive' : 'outline'}>Fiabilidad {u.reputationScore}</Badge>
                  {u.role !== 'USER' ? <Badge>{u.role}</Badge> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
