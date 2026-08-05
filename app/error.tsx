'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="home-hero">
      <div className="container flex min-h-[70vh] flex-col items-center justify-center pb-16 pt-14 text-center">
        <div className="home-fade-up flex flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card shadow-elevated">
            <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
          </span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t.errors.unexpectedKicker}</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{t.errors.unexpectedTitle}</h1>
          <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
            {t.errors.unexpectedBody}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => reset()} variant="outline" size="lg" className="rounded-full px-6">
              {t.errors.tryAgain}
            </Button>
            <Button asChild size="lg" className="btn-cta rounded-full px-6">
              <Link href="/">{t.common.backToHome}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
