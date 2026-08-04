// @vitest-environment node
// Entorno node (no jsdom): la subida de fotos usa req.formData(), y el
// FormData/File de jsdom no es compatible con undici (NextRequest). En node
// se usan los globales de undici, como en producción.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks (hoisted) -------------------------------------------------------

const spotFindUnique = vi.hoisted(() => vi.fn());
const photoFindMany = vi.hoisted(() => vi.fn());
const photoCreate = vi.hoisted(() => vi.fn());
const photoFindUnique = vi.hoisted(() => vi.fn());
const photoDelete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    parkingSpot: { findUnique: spotFindUnique },
    spotPhoto: {
      findMany: photoFindMany,
      create: photoCreate,
      findUnique: photoFindUnique,
      delete: photoDelete,
    },
  },
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ auth: authMock }));

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 4, retryAfterSec: 3600 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

// Storage mockeado: los tests nunca tocan Supabase real.
const uploadMock = vi.hoisted(() =>
  vi.fn<(path: string, data: Buffer, contentType: string) => Promise<void>>(async () => {}),
);
const deleteStorageMock = vi.hoisted(() => vi.fn<(path: string) => Promise<void>>(async () => {}));
vi.mock('@/lib/supabaseStorage', () => ({
  uploadSpotPhoto: uploadMock,
  deleteSpotPhoto: deleteStorageMock,
  spotPhotoPublicUrl: (path: string) => `https://supabase.test/storage/v1/object/public/spot-photos/${path}`,
}));

import { GET, POST } from '@/app/api/spots/[id]/photos/route';
import { DELETE } from '@/app/api/spots/[id]/photos/[photoId]/route';

const USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'USER' };
const MODERATOR = { id: 'mod-1', name: 'Mod', email: 'mod@example.com', role: 'MODERATOR' };

const PHOTO_ROW = {
  id: 'p1',
  spotId: 7,
  userId: 'user-1',
  url: 'https://supabase.test/storage/v1/object/public/spot-photos/7/user-1/x.jpg',
  storagePath: '7/user-1/x.jpg',
  hidden: false,
  createdAt: new Date('2026-08-05T10:00:00Z'),
  user: { name: 'Ana' },
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function childParams(id: string, photoId: string) {
  return { params: Promise.resolve({ id, photoId }) };
}

function uploadReq(file: { name: string; type: string; content: string } | null): NextRequest {
  const form = new FormData();
  if (file) {
    form.append('file', new File([file.content], file.name, { type: file.type }));
  }
  return new NextRequest('http://localhost/api/spots/7/photos', { method: 'POST', body: form });
}

describe('GET /api/spots/[id]/photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    photoFindMany.mockResolvedValue([PHOTO_ROW]);
  });

  it('devuelve solo fotos visibles con nombre de autor, sin email', async () => {
    const res = await GET(new NextRequest('http://localhost/api/spots/7/photos'), params('7'));
    expect(res.status).toBe(200);
    expect(photoFindMany.mock.calls[0][0].where).toEqual({ spotId: 7, hidden: false });
    const json = await res.json();
    expect(json[0]).toMatchObject({ id: 'p1', url: PHOTO_ROW.url, authorName: 'Ana' });
    expect(json[0]).not.toHaveProperty('email');
  });
});

describe('POST /api/spots/[id]/photos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: USER });
    spotFindUnique.mockResolvedValue({ id: 7 });
    photoCreate.mockResolvedValue(PHOTO_ROW);
  });

  it('401 si no hay sesión', async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(uploadReq({ name: 'f.jpg', type: 'image/jpeg', content: 'jpeg-bytes' }), params('7'));
    expect(res.status).toBe(401);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('400 si no se adjunta archivo', async () => {
    const res = await POST(uploadReq(null), params('7'));
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('400 si el tipo mime no está permitido', async () => {
    const res = await POST(uploadReq({ name: 'doc.pdf', type: 'application/pdf', content: 'pdf' }), params('7'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Formato no permitido/);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('400 si supera 5 MB', async () => {
    const big = new File(['x'.repeat(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    const form = new FormData();
    form.append('file', big);
    const req = new NextRequest('http://localhost/api/spots/7/photos', { method: 'POST', body: form });
    const res = await POST(req, params('7'));
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('201 sube a Storage con path spotId/userId/... y guarda la URL pública', async () => {
    const res = await POST(uploadReq({ name: 'foto.jpg', type: 'image/jpeg', content: 'jpeg-bytes' }), params('7'));
    expect(res.status).toBe(201);

    const [storagePath, , contentType] = uploadMock.mock.calls[0];
    expect(storagePath).toMatch(/^7\/user-1\/\d+-[0-9a-f]{12}\.jpg$/);
    expect(contentType).toBe('image/jpeg');

    const createData = photoCreate.mock.calls[0][0].data;
    expect(createData.spotId).toBe(7);
    expect(createData.userId).toBe('user-1');
    expect(createData.storagePath).toBe(storagePath);
    expect(createData.url).toContain('https://supabase.test/storage/v1/object/public/spot-photos/');

    const json = await res.json();
    expect(json).toMatchObject({ id: 'p1', authorName: 'Ana' });
  });

  it('404 si la plaza no existe (antes de tocar Storage)', async () => {
    spotFindUnique.mockResolvedValue(null);
    const res = await POST(uploadReq({ name: 'f.jpg', type: 'image/jpeg', content: 'x' }), params('7'));
    expect(res.status).toBe(404);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/spots/[id]/photos/[photoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    photoFindUnique.mockResolvedValue(PHOTO_ROW);
    photoDelete.mockResolvedValue(PHOTO_ROW);
  });

  it('el autor borra: primero del bucket y luego de la DB', async () => {
    authMock.mockResolvedValue({ user: USER });
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'p1'));
    expect(res.status).toBe(200);
    expect(deleteStorageMock).toHaveBeenCalledWith('7/user-1/x.jpg');
    expect(photoDelete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    // Orden: bucket antes que DB.
    expect(deleteStorageMock.mock.invocationCallOrder[0]).toBeLessThan(photoDelete.mock.invocationCallOrder[0]);
  });

  it('un usuario ajeno recibe 403 y no se toca nada', async () => {
    authMock.mockResolvedValue({ user: { ...USER, id: 'otro' } });
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'p1'));
    expect(res.status).toBe(403);
    expect(deleteStorageMock).not.toHaveBeenCalled();
    expect(photoDelete).not.toHaveBeenCalled();
  });

  it('un moderador NO puede borrar en firme (debe ocultar con PATCH)', async () => {
    authMock.mockResolvedValue({ user: MODERATOR });
    const res = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), childParams('7', 'p1'));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/ocultan/i);
    expect(deleteStorageMock).not.toHaveBeenCalled();
  });
});
