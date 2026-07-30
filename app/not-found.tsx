import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <MapPin className="h-12 w-12 text-muted-foreground" />
      <h1 className="mt-4 text-3xl font-extrabold">Página no encontrada</h1>
      <p className="mt-2 text-muted-foreground">
        La plaza o página que buscas no existe en MinusVigo.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
