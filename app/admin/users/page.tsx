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
      <h1 className="mb-6 text-2xl font-extrabold">Usuarios</h1>
      <Card>
        <CardHeader>
          <CardTitle>{users.length} usuarios registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
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
