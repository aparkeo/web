import Link from 'next/link';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getServerDictionary } from '@/lib/i18n/server';

export default async function NotFound() {
  const t = await getServerDictionary();

  return (
    <div className="home-hero">
      <div className="container flex min-h-[70vh] flex-col items-center justify-center pb-16 pt-14 text-center">
        <div className="home-fade-up flex flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card shadow-elevated">
            <MapPinOff className="h-10 w-10 text-primary" aria-hidden="true" />
          </span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.errors.notFoundKicker}</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.errors.notFoundTitle}
          </h1>
          <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
            {t.errors.notFoundBody}
          </p>
          <Button asChild size="lg" className="btn-cta mt-8 rounded-full px-6">
            <Link href="/">{t.common.backToHome}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
