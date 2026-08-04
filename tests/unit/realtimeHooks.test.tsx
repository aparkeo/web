import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// --- Mock de @supabase/supabase-js ---------------------------------------
// Canal falso que registra las suscripciones postgres_changes y el callback
// de estado, para simular eventos y SUBSCRIBED desde los tests.

type ChangeHandler = (payload?: unknown) => void;
type StatusHandler = (status: string) => void;

interface FakeSub {
  opts: Record<string, unknown>;
  cb: ChangeHandler;
}
interface FakeChannel {
  name: string;
  subs: FakeSub[];
  statusCb?: StatusHandler;
  on: (type: string, opts: Record<string, unknown>, cb: ChangeHandler) => FakeChannel;
  subscribe: (cb?: StatusHandler) => FakeChannel;
}

const rt = vi.hoisted(() => {
  const channels: FakeChannel[] = [];
  const removeChannel = vi.fn();
  const client = {
    channel(name: string): FakeChannel {
      const ch: FakeChannel = {
        name,
        subs: [],
        on(_type: string, opts: Record<string, unknown>, cb: ChangeHandler) {
          ch.subs.push({ opts, cb });
          return ch;
        },
        subscribe(cb?: StatusHandler) {
          ch.statusCb = cb;
          return ch;
        },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel,
  };
  return { channels, removeChannel, client };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => rt.client),
}));

import { useRealtimeSpots } from '@/hooks/useRealtimeSpots';
import { useRealtimeSpot } from '@/hooks/useRealtimeSpot';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
});

beforeEach(() => {
  rt.channels.length = 0;
  rt.removeChannel.mockClear();
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, wrapper };
}

describe('useRealtimeSpots (mapa / lista de plazas)', () => {
  it('se suscribe a parking_spots y avisa del estado del canal', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useRealtimeSpots(), { wrapper });

    expect(rt.channels).toHaveLength(1);
    expect(rt.channels[0].subs).toHaveLength(1);
    expect(rt.channels[0].subs[0].opts).toEqual({
      event: '*',
      schema: 'public',
      table: 'parking_spots',
    });

    expect(result.current).toBe(false);
    // Llaves para que el callback de act devuelva void (invalidateQueries
    // devuelve una Promise y act la interpretaría como act async).
    act(() => {
      rt.channels[0].statusCb?.('SUBSCRIBED');
    });
    expect(result.current).toBe(true);
  });

  it('invalida las queries de plazas al llegar un evento', () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useRealtimeSpots(), { wrapper });

    act(() => {
      rt.channels[0].subs[0].cb({ eventType: 'UPDATE' });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spots'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spot'] });
  });

  it('llama a removeChannel al desmontar (cleanup, StrictMode-safe)', () => {
    const { wrapper } = setup();
    const { unmount } = renderHook(() => useRealtimeSpots(), { wrapper });

    unmount();
    expect(rt.removeChannel).toHaveBeenCalledWith(rt.channels[0]);
  });
});

describe('useRealtimeSpot (detalle de plaza)', () => {
  it('crea un canal por plaza con los tres filtros correctos', () => {
    const { wrapper } = setup();
    renderHook(() => useRealtimeSpot(7), { wrapper });

    expect(rt.channels).toHaveLength(1);
    expect(rt.channels[0].name).toBe('spot:7');
    expect(rt.channels[0].subs.map((s) => s.opts)).toEqual([
      { event: '*', schema: 'public', table: 'parking_spots', filter: 'id=eq.7' },
      { event: '*', schema: 'public', table: 'spot_photos', filter: 'spotId=eq.7' },
      { event: '*', schema: 'public', table: 'spot_comments', filter: 'spotId=eq.7' },
    ]);
  });

  it('invalida la query correcta según la tabla del evento', () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useRealtimeSpot(7), { wrapper });
    const [spotSub, photoSub, commentSub] = rt.channels[0].subs;

    act(() => {
      spotSub.cb({});
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spot', 7] });

    act(() => {
      photoSub.cb({});
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spotPhotos', 7] });

    act(() => {
      commentSub.cb({});
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spotComments', 7] });
  });

  it('expone live=true al suscribirse y limpia el canal al desmontar', () => {
    const { wrapper } = setup();
    const { result, unmount } = renderHook(() => useRealtimeSpot(7), { wrapper });

    act(() => {
      rt.channels[0].statusCb?.('SUBSCRIBED');
    });
    expect(result.current).toBe(true);

    unmount();
    expect(rt.removeChannel).toHaveBeenCalledWith(rt.channels[0]);
  });
});
