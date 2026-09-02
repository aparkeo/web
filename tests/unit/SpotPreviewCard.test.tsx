import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpotPreviewCard } from '@/components/SpotPreviewCard';
import type { SpotDTO } from '@/types';

// Tarjeta flotante de plaza (1 clic en el pin). Verifica el contenido base y
// la regla de la predicción: visible cuando el modelo tiene señal, oculta
// cuando source === 'none' (la tarjeta no se alarga sin datos).

const SPOT: SpotDTO = {
  id: 42,
  city: 'Vigo',
  street: 'Rúa do Príncipe',
  lat: 42.24,
  lon: -8.72,
  spaces: 1,
  status: 'FREE',
  confidence: 'CONFIRMED',
  lastReportAt: null,
  distanceM: 350,
};

function mockFetch(predictionSource: 'live' | 'historical' | 'blended' | 'none') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/photos')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes('/api/predictions')) {
        return new Response(
          JSON.stringify({
            spotId: SPOT.id,
            probabilityFree: 0.87,
            confidenceLabel: 'Media',
            source: predictionSource,
            lastUpdated: null,
            sampleSize: 12,
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    }),
  );
}

function renderCard(onNavigate: (spot: SpotDTO) => void = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SpotPreviewCard spot={SPOT} onClose={() => {}} onNavigate={onNavigate} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SpotPreviewCard', () => {
  it('muestra calle, estado, distancia y los dos CTA', () => {
    mockFetch('none');
    renderCard();

    expect(screen.getByRole('dialog', { name: 'Rúa do Príncipe' })).toBeInTheDocument();
    expect(screen.getByText('Libre')).toBeInTheDocument();
    expect(screen.getByText(/350\s*m/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Cómo llegar a Rúa do Príncipe/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalles' })).toHaveAttribute(
      'href',
      '/spots/42',
    );
  });

  it('«Cómo llegar» lanza la ruta interna con la plaza (no abre Google Maps)', () => {
    mockFetch('none');
    const onNavigate = vi.fn();
    renderCard(onNavigate);

    fireEvent.click(screen.getByRole('button', { name: /Cómo llegar a Rúa do Príncipe/ }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(SPOT);
  });

  it('muestra la predicción de la IA cuando el modelo tiene señal', async () => {
    mockFetch('historical');
    renderCard();

    await waitFor(() => {
      expect(screen.getByText('87%')).toBeInTheDocument();
    });
    expect(screen.getByText(/probabilidad libre/)).toBeInTheDocument();
  });

  it('oculta la predicción cuando no hay datos (source none)', async () => {
    mockFetch('none');
    renderCard();

    // Espera a que la query se resuelva y confirma que la fila no aparece.
    await waitFor(() => {
      expect(screen.queryByText('87%')).not.toBeInTheDocument();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/probabilidad libre/)).not.toBeInTheDocument();
  });
});
