'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  /** Título del contenido compartido (usado por la Web Share API). */
  title: string;
  /** Texto humano que acompaña al enlace al compartir. */
  text: string;
  /** URL a compartir; por defecto, la página actual. */
  url?: string;
  /** Si se indica, el botón muestra el icono + etiqueta (outline); si no, es un botón fantasma solo icono. */
  label?: string;
  className?: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function ShareButton({ title, text, url, label, className }: ShareButtonProps) {
  async function handleShare() {
    const shareUrl = url ?? window.location.href;

    // Móviles: hoja de compartir nativa (WhatsApp, Telegram, X…).
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch (error) {
        // AbortError = el usuario cerró la hoja de compartir: no es un fallo.
        if (!isAbortError(error)) {
          toast.error('No se pudo compartir el enlace');
        }
      }
      return;
    }

    // Escritorio (sin Web Share API): copiar al portapapeles.
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }

  if (label) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleShare}
        className={cn('min-h-11 gap-2 rounded-full', className)}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleShare}
      className={cn('min-h-11 min-w-11', className)}
      aria-label="Compartir"
    >
      <Share2 className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
