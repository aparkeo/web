'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h1 className="mt-4 text-3xl font-extrabold">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al inicio.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()} variant="outline">
          Intentar de nuevo
        </Button>
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
