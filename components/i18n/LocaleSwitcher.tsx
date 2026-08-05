'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';
import { LANG_COOKIE, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'gl', label: 'GL' },
];

/**
 * Selector ES/GL del Navbar (desktop y menú móvil). Escribe la cookie `lang`
 * (1 año) y pide un refresh del App Router: los server components re-renderizan
 * con el nuevo idioma y el I18nProvider recibe el diccionario nuevo — sin
 * recarga completa de página.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const { locale, t } = useI18n();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div
      role="group"
      aria-label={t.nav.languageSwitcher}
      className={cn(
        'flex overflow-hidden rounded-full border border-border bg-secondary/60 p-0.5 shadow-sm',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = locale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            lang={opt.value}
            onClick={() => switchTo(opt.value)}
            className={cn(
              'min-h-9 rounded-full px-3 text-xs font-bold transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
