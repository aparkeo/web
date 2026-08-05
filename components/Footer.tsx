import Link from 'next/link';
import { Github, Heart } from 'lucide-react';
import { SITE_GITHUB_URL } from '@/lib/site';
import { TourRelaunchButton } from '@/components/TourRelaunchButton';

/**
 * Pie discreto del sitio: enlaces de transparencia (privacidad RGPD, código
 * abierto en GitHub y panel público de analítica).
 */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>MinusVigo · Proyecto comunitario</p>
        <nav className="flex items-center gap-5" aria-label="Enlaces de pie de página">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacidad
          </Link>
          <a
            href={SITE_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" aria-hidden="true" /> GitHub
          </a>
          <Link href="/analytics" className="transition-colors hover:text-foreground">
            Analítica
          </Link>
          <Link
            href="/apoyo"
            className="flex min-h-11 items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Heart className="h-4 w-4" aria-hidden="true" /> Apoya el proyecto
          </Link>
          <TourRelaunchButton />
        </nav>
      </div>
    </footer>
  );
}
