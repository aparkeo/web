import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { UtmTracker } from '@/components/UtmTracker';

function setUrl(url: string) {
  window.history.replaceState(null, '', url);
}

describe('UtmTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    setUrl('/');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  it('captura los UTM de la URL y envía POST /api/track con keepalive', async () => {
    setUrl('/?utm_source=cartel&utm_medium=qr&utm_campaign=lanzamiento');
    render(<UtmTracker />);

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/track');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({
      source: 'cartel',
      medium: 'qr',
      campaign: 'lanzamiento',
    });
  });

  it('limpia los utm_* de la URL tras capturarlos (sin navegar)', async () => {
    setUrl('/?utm_source=instagram&utm_medium=stories&foo=bar');
    render(<UtmTracker />);

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(window.location.search).toBe('?foo=bar');
    expect(window.location.pathname).toBe('/');
  });

  it('dedup por sesión: la misma combinación solo se envía una vez', async () => {
    setUrl('/?utm_source=whatsapp&utm_medium=mensaje&utm_campaign=lanzamiento');
    const first = render(<UtmTracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    first.unmount();

    // Segunda carga (p.ej. refresco o navegación de vuelta): no reenvía.
    render(<UtmTracker />);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('canales distintos en la misma sesión sí se envían por separado', async () => {
    setUrl('/?utm_source=cartel&utm_medium=qr');
    const first = render(<UtmTracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    first.unmount();

    setUrl('/?utm_source=telegram&utm_medium=mensaje');
    render(<UtmTracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('sin utm_source válido no hace nada', async () => {
    for (const url of ['/', '/?utm_medium=qr', '/?utm_source=<script>']) {
      setUrl(url);
      const view = render(<UtmTracker />);
      await new Promise((r) => setTimeout(r, 10));
      view.unmount();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('si sessionStorage está inaccesible, falla en silencio sin romper el render', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    setUrl('/?utm_source=cartel');
    expect(() => render(<UtmTracker />)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(fetch).not.toHaveBeenCalled();
  });
});
