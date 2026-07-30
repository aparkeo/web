import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SpotCard } from '@/components/SpotCard';
import type { SpotDTO } from '@/types';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [user, favorites, reportCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.favorite.findMany({ where: { userId: session.user.id }, include: { spot: true } }),
    prisma.report.count({ where: { userId: session.user.id } }),
  ]);

  if (!user) redirect('/login');

  const favoriteSpots: SpotDTO[] = favorites.map((f) => ({
    id: f.spot.id,
    city: f.spot.city,
    street: f.spot.street,
    lat: f.spot.lat,
    lon: f.spot.lon,
    spaces: f.spot.spaces,
    status: f.spot.status,
    confidence: f.spot.confidence,
    lastReportAt: f.spot.lastReportAt?.toISOString() ?? null,
    isFavorite: true,
  }));

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{user.name?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-extrabold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline">Fiabilidad: {user.reputationScore}</Badge>
              <Badge variant="outline">{reportCount} reportes</Badge>
              {user.role === 'ADMIN' ? <Badge>Administrador</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis plazas favoritas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {favoriteSpots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes favoritas. Márcalas con ★ desde el mapa o la lista.
            </p>
          ) : (
            favoriteSpots.map((spot) => <SpotCard key={spot.id} spot={spot} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
