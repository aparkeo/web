import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OnboardingTourProvider, useOnboardingTour } from '@/components/OnboardingTour';
import { TOUR_AUTO_START_DELAY_MS, TOUR_DONE_STORAGE_KEY } from '@/lib/onboardingTour';

// Mock de navegación: pathname mutable y router espiado.
let mockPathname = '/map';
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: pushMock }),
}));

// Consumidor de prueba para el relanzamiento manual (mismo patrón que el
// botón «Ver tour» del Footer).
function Relaunch() {
  const { startTour } = useOnboardingTour();
  return (
    <button type="button" onClick={startTour}>
      Abrir tour
    </button>
  );
}

function renderTour() {
  return render(
    <OnboardingTourProvider>
      <div data-tour="map">Mapa</div>
      <Relaunch />
    </OnboardingTourProvider>,
  );
}

function startAutoTourWithFakeTimers() {
  vi.useFakeTimers();
  renderTour();
  act(() => {
    vi.advanceTimersByTime(TOUR_AUTO_START_DELAY_MS + 10);
  });
  vi.useRealTimers();
}

describe('OnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = '/map';
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('se auto-lanza en la primera visita al mapa tras la pausa inicial', () => {
    startAutoTourWithFakeTimers();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('El mapa, de un vistazo')).toBeInTheDocument();
  });

  it('no se auto-lanza si el flag de localStorage ya existe', () => {
    localStorage.setItem(TOUR_DONE_STORAGE_KEY, '1');
    startAutoTourWithFakeTimers();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no se auto-lanza fuera de la home y el mapa', () => {
    mockPathname = '/login';
    startAutoTourWithFakeTimers();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no se auto-lanza antes de la pausa inicial', () => {
    vi.useFakeTimers();
    renderTour();
    act(() => {
      vi.advanceTimersByTime(TOUR_AUTO_START_DELAY_MS - 100);
    });
    vi.useRealTimers();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('recorre los pasos con Siguiente y Anterior', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    expect(screen.getByText('El mapa, de un vistazo')).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByText('¿Ves una plaza? Cuéntalo')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByText('Activa los avisos')).toBeInTheDocument();
    expect(screen.getByText('Paso 3 de 4')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Anterior'));
    expect(screen.getByText('¿Ves una plaza? Cuéntalo')).toBeInTheDocument();
  });

  it('el último paso muestra el CTA «Explorar el mapa» y al pulsarlo cierra y guarda el flag', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.click(screen.getByText('Siguiente'));

    expect(screen.getByText('Listo, a aparcar')).toBeInTheDocument();
    expect(screen.queryByText('Anterior')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Explorar el mapa'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_DONE_STORAGE_KEY)).toBe('1');
  });

  it('«Saltar» cierra el tour y guarda el flag', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    fireEvent.click(screen.getByText('Saltar'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_DONE_STORAGE_KEY)).toBe('1');
  });

  it('Escape cierra el tour y guarda el flag', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_DONE_STORAGE_KEY)).toBe('1');
  });

  it('las flechas del teclado navegan entre pasos', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('¿Ves una plaza? Cuéntalo')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('El mapa, de un vistazo')).toBeInTheDocument();
  });

  it('el diálogo es accesible: role dialog, modal y con título y descripción enlazados', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'tour-step-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'tour-step-body');
    expect(document.getElementById('tour-step-title')).not.toBeNull();
    expect(document.getElementById('tour-step-body')).not.toBeNull();
  });

  it('el relanzamiento manual desde otra página navega al mapa', () => {
    mockPathname = '/stats';
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    expect(pushMock).toHaveBeenCalledWith('/map');
    // Hasta llegar al mapa no se abre (efecto de pendingStart).
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tras cerrar, el tour puede re-lanzarse manualmente', () => {
    renderTour();
    fireEvent.click(screen.getByText('Abrir tour'));
    fireEvent.click(screen.getByText('Saltar'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Abrir tour'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('El mapa, de un vistazo')).toBeInTheDocument();
  });
});
