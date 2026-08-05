import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (hoisted) -------------------------------------------------------

const userFindUnique = vi.hoisted(() => vi.fn());
const reportFindMany = vi.hoisted(() => vi.fn());
const favoriteFindMany = vi.hoisted(() => vi.fn());
const commentFindMany = vi.hoisted(() => vi.fn());
const photoFindMany = vi.hoisted(() => vi.fn());
const notificationFindMany = vi.hoisted(() => vi.fn());
const pushFindMany = vi.hoisted(() => vi.fn());
const eventFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    report: { findMany: reportFindMany },
    favorite: { findMany: favoriteFindMany },
    spotComment: { findMany: commentFindMany },
    spotPhoto: { findMany: photoFindMany },
    notification: { findMany: notificationFindMany },
    pushSubscription: { findMany: pushFindMany },
    event: { findMany: eventFindMany },
  },
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: authMock }));

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: rateLimitMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

import { GET } from '@/app/api/user/export/route';

const USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'USER' };

describe('GET /api/user/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: USER });
    rateLimitMock.mockResolvedValue({ success: true, remaining: 4, retryAfterSec: 3600 });
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.com',
      role: 'USER',
      reputationScore: 100,
      createdAt: new Date('2026-08-01T10:00:00Z'),
    });
    reportFindMany.mockResolvedValue([
      {
        id: 'r1',
        spotId: 7,
        spot: { street: 'Rúa do Príncipe' },
        status: 'FREE',
        lat: 42.23,
        lon: -8.72,
        accuracyM: 12.5,
        reportedAt: new Date('2026-08-04T09:00:00Z'),
      },
    ]);
    favoriteFindMany.mockResolvedValue([
      { spot: { id: 7, street: 'Rúa do Príncipe' }, createdAt: new Date('2026-08-02T09:00:00Z') },
    ]);
    commentFindMany.mockResolvedValue([
      {
        id: 'c1',
        spotId: 7,
        spot: { street: 'Rúa do Príncipe' },
        body: 'Suele estar libre por las mañanas',
        hidden: false,
        createdAt: new Date('2026-08-03T09:00:00Z'),
      },
    ]);
    photoFindMany.mockResolvedValue([
      {
        id: 'p1',
        spotId: 7,
        spot: { street: 'Rúa do Príncipe' },
        url: 'https://supabase.test/storage/v1/object/public/spot-photos/7/user-1/x.jpg',
        hidden: false,
        createdAt: new Date('2026-08-03T10:00:00Z'),
      },
    ]);
    notificationFindMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'FAVORITE_FREED',
        title: 'Plaza libre',
        body: 'Rúa do Príncipe',
        read: true,
        createdAt: new Date('2026-08-04T10:00:00Z'),
      },
    ]);
    pushFindMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example/abc', createdAt: new Date('2026-08-01T11:00:00Z') },
    ]);
    eventFindMany.mockResolvedValue([
      { id: 'e1', type: 'spot_report', metadata: { spotId: 7 }, createdAt: new Date('2026-08-04T09:00:01Z') },
    ]);
  });

  it('requiere autenticación (401)', async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('aplica rate limit (429)', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, retryAfterSec: 600 });
    const res = await GET();
    expect(res.status).toBe(429);
    expect(rateLimitMock).toHaveBeenCalledWith('user-export:user-1', 5, 3_600_000);
  });

  it('devuelve un JSON descargable (attachment)', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="minusvigo-mis-datos\.json"$/);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('incluye el perfil SIN el hash de la contraseña y todas las colecciones', async () => {
    const res = await GET();
    const body = await res.text();
    expect(body).not.toContain('password');
    expect(body).not.toContain('$2a$'); // prefijo de hashes bcrypt

    const json = JSON.parse(body);
    expect(json.perfil).toEqual({
      id: 'user-1',
      nombre: 'Ana',
      email: 'ana@example.com',
      rol: 'USER',
      puntuacionDeFiabilidad: 100,
      cuentaCreadaEl: '2026-08-01T10:00:00.000Z',
    });
    expect(json.reportes).toHaveLength(1);
    expect(json.reportes[0]).toMatchObject({
      plaza: { id: 7, calle: 'Rúa do Príncipe' },
      estado: 'FREE',
      lat: 42.23,
      precisionGpsMetros: 12.5,
    });
    expect(json.favoritos).toHaveLength(1);
    expect(json.comentarios).toHaveLength(1);
    expect(json.fotos[0].url).toContain('spot-photos');
    expect(json.notificaciones).toHaveLength(1);
    expect(json.suscripcionesPush[0].endpoint).toBe('https://push.example/abc');
    expect(json.eventos[0].tipo).toBe('spot_report');
    expect(json.exportedAt).toBeTruthy();
  });

  it('el select del perfil nunca pide el campo password a la DB', async () => {
    await GET();
    const select = userFindUnique.mock.calls[0][0].select as Record<string, true>;
    expect(select).not.toHaveProperty('password');
  });
});
