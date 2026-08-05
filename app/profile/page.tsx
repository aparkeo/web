import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SpotCard } from '@/components/SpotCard';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { getServerDictionary } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n/format';
import type { SpotDTO } from '@/types';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [user, favorites, reportCount, t] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.favorite.findMany({ where: { userId: session.user.id }, include: { spot: true } }),
    prisma.report.count({ where: { userId: session.user.id } }),
    getServerDictionary(),
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
                {fmt(t.profile.reputation, { n: user.reputationScore })}
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                {fmt(t.profile.reportCount, { n: reportCount })}
              </Badge>
              {user.role === 'ADMIN' ? <Badge className="px-3 py-1">{t.profile.admin}</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.profile.communityKicker}</p>
          <CardTitle className="tracking-tight">{t.profile.favoritesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {favoriteSpots.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{t.profile.favoritesEmpty}</p>
          ) : (
            favoriteSpots.map((spot) => <SpotCard key={spot.id} spot={spot} />)
          )}
        </CardContent>
      </Card>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.profile.privacyKicker}</p>
          <CardTitle className="tracking-tight">{t.profile.yourDataTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.profile.yourDataText}{' '}
            <Link href="/privacy" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t.profile.privacyPolicy}
            </Link>
            .
          </p>
          <Button asChild variant="outline">
            <a href="/api/user/export">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> {t.profile.downloadData}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="home-fade-up home-fade-up-delay rounded-2xl border-destructive/40 shadow-elevated">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-destructive">{t.profile.dangerKicker}</p>
          <CardTitle className="tracking-tight">{t.profile.deleteTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{t.profile.deleteText}</p>
          <DeleteAccountButton />
        </CardContent>
      </Card>
    </div>
  );
}
