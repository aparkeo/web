'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';

/**
 * Banner fijo bajo el navbar (h-16) que avisa cuando el usuario se queda
 * sin conexión. Aparece/desaparece con transición de opacidad, compatible
 * con prefers-reduced-motion (globals.css permite fundidos suaves).
 */
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const t = useT();

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-16 z-30 flex justify-center px-4 transition-opacity duration-300 ease-out ${
        isOffline ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <p className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t.map.offline}
      </p>
    </div>
  );
}
