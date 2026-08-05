'use client';

import { CircleHelp } from 'lucide-react';
import { useOnboardingTour } from '@/components/OnboardingTour';

/**
 * Entrada permanente para re-lanzar el tour de onboarding desde el pie de
 * página, visible en todas las páginas haya sesión o no. Navega al mapa si
 * hace falta (los pasos del tour viven allí).
 */
export function TourRelaunchButton() {
  const { startTour } = useOnboardingTour();

  return (
    <button
      type="button"
      onClick={startTour}
      className="flex min-h-11 items-center gap-1.5 transition-colors hover:text-foreground"
    >
      <CircleHelp className="h-4 w-4" aria-hidden="true" /> Ver tour
    </button>
  );
}
