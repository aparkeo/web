import Link from 'next/link';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="home-hero">
      <div className="container flex min-h-[70vh] flex-col items-center justify-center pb-16 pt-14 text-center">
        <div className="home-fade-up flex flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card shadow-elevated">
            <MapPinOff className="h-10 w-10 text-primary" aria-hidden="true" />
          </span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Error 404</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Página no encontrada
          </h1>
          <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
            La plaza o página que buscas no existe en MinusVigo. Puede que el enlace esté roto o que la plaza se
            haya dado de baja.
          </p>
          <Button asChild size="lg" className="btn-cta mt-8 rounded-full px-6">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
