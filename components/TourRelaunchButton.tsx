'use client';

import { CircleHelp } from 'lucide-react';
import { useOnboardingTour } from '@/components/OnboardingTour';
import { useT } from '@/components/i18n/I18nProvider';

/**
 * Entrada permanente para re-lanzar el tour de onboarding desde el pie de
 * página, visible en todas las páginas haya sesión o no. Navega al mapa si
 * hace falta (los pasos del tour viven allí).
 */
export function TourRelaunchButton() {
  const { startTour } = useOnboardingTour();
  const t = useT();

  return (
    <button
      type="button"
      onClick={startTour}
      className="flex min-h-11 items-center gap-1.5 transition-colors hover:text-foreground"
    >
      <CircleHelp className="h-4 w-4" aria-hidden="true" /> {t.footer.viewTour}
    </button>
  );
}
