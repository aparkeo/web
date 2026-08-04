'use client';

/**
 * Indicador visual sutil del feed en tiempo real: punto verde «En directo».
 * Solo se renderiza cuando el canal está SUBSCRIBED (live=true); en caso
 * contrario no ocupa espacio ni muestra estados de error (la app sigue
 * funcionando con polling).
 */
export function LiveIndicator({ live }: { live: boolean }) {
  if (!live) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
      role="status"
      aria-label="Actualización en directo activada"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      En directo
    </span>
  );
}
