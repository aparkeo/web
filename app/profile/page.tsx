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
    <div className="container max-w-3xl space-y-6 pb-16 pt-10 sm:pt-14">
      <Card className="home-fade-up rounded-2xl shadow-elevated">
        <CardContent className="flex items-center gap-4 p-6 sm:gap-5 sm:p-7">
          <Avatar className="h-16 w-16 ring-2 ring-primary/15">
            <AvatarFallback className="bg-secondary text-xl font-extrabold text-primary">
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Badge variant="outline" className="px-3 py-1">
                Fiabilidad: {user.reputationScore}
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                {reportCount} reportes
              </Badge>
              {user.role === 'ADMIN' ? <Badge className="px-3 py-1">Administrador</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Comunidad</p>
          <CardTitle className="tracking-tight">Mis plazas favoritas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {favoriteSpots.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
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
