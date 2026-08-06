import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { ShareButton } from '@/components/ShareButton';

function setNavigatorProp(name: string, value: unknown) {
  Object.defineProperty(window.navigator, name, { value, configurable: true, writable: true });
}

afterEach(() => {
  vi.clearAllMocks();
  setNavigatorProp('share', undefined);
  setNavigatorProp('clipboard', undefined);
});

describe('ShareButton', () => {
  it('usa navigator.share en móvil con el payload correcto y sin toasts', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('share', share);

    render(<ShareButton title="Plaza PMR en Gran Vía | Aparkeo Vigo" text="Plaza PMR en Gran Vía — mira si está libre en Aparkeo Vigo" url="https://aparkeo.com/spots/7" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: 'Plaza PMR en Gran Vía | Aparkeo Vigo',
        text: 'Plaza PMR en Gran Vía — mira si está libre en Aparkeo Vigo',
        url: 'https://aparkeo.com/spots/7',
      });
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('usa la URL de la página actual si no se pasa url', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('share', share);

    render(<ShareButton title="T" text="x" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: window.location.href }));
    });
  });

  it('si el usuario cancela la hoja de compartir (AbortError) no muestra error', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    setNavigatorProp('share', share);

    render(<ShareButton title="T" text="x" url="https://example.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    // Deja pasar el microtask del catch
    await waitFor(() => expect(toastError).not.toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('sin Web Share API copia la URL al portapapeles y muestra «Enlace copiado»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp('clipboard', { writeText });

    render(<ShareButton title="T" text="x" url="https://aparkeo.com/analytics" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://aparkeo.com/analytics'));
    expect(toastSuccess).toHaveBeenCalledWith('Enlace copiado');
  });

  it('si el portapapeles falla muestra un toast de error', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setNavigatorProp('clipboard', { writeText });

    render(<ShareButton title="T" text="x" url="https://example.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('No se pudo copiar el enlace'));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('con label renderiza un botón con texto accesible y tap target amplio', () => {
    render(<ShareButton title="T" text="x" label="Compartir" url="https://example.com" />);
    const button = screen.getByRole('button', { name: 'Compartir' });
    expect(button).toHaveTextContent('Compartir');
    expect(button.className).toContain('min-h-11');
  });

  it('sin label es un botón solo icono con aria-label y 44px mínimos', () => {
    render(<ShareButton title="T" text="x" url="https://example.com" />);
    const button = screen.getByRole('button', { name: 'Compartir' });
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
  });
});
